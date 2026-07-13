import type { WebSocket } from 'ws';
import { recordGame } from './db.js';
import { chooseBid, chooseCard } from '../shared/ai.js';
import {
  collectTrick,
  legalBids,
  legalPlays,
  newGame,
  placeBid,
  playCard,
  startNextHand
} from '../shared/engine.js';
import { GameConfig, GameState, HAND_SIZES, PlayerInfo } from '../shared/types.js';

const TRICK_PAUSE_MS = Number(process.env.TRICK_PAUSE_MS) || 2000;
const BOT_THINK_MS = Number(process.env.BOT_THINK_MS) || 900;

interface Connection {
  ws: WebSocket;
  seat: number | null; // null = table display / spectator
  token: string;
}

interface SeatSlot {
  player: PlayerInfo | null;
  token: string | null; // rejoin token of the human in this seat
}

export class Room {
  code: string;
  config: GameConfig;
  hostToken: string;
  seats: SeatSlot[];
  connections = new Set<Connection>();
  state: GameState | null = null;
  /** bumped whenever the game state changes, to invalidate stale timers */
  private generation = 0;
  private resultRecorded = false;
  lastActivity = Date.now();

  constructor(code: string, config: GameConfig, hostToken: string) {
    this.code = code;
    this.config = config;
    this.hostToken = hostToken;
    this.seats = Array.from({ length: config.seatCount }, () => ({
      player: null,
      token: null
    }));
  }

  addConnection(ws: WebSocket, token: string): Connection {
    // Reclaim a seat if this token already owns one (phone reconnect).
    let seat: number | null = null;
    const idx = this.seats.findIndex((s) => s.token === token);
    if (idx >= 0) {
      seat = idx;
      this.setConnected(idx, true);
    }
    const conn: Connection = { ws, seat, token };
    this.connections.add(conn);
    return conn;
  }

  dropConnection(conn: Connection): void {
    this.connections.delete(conn);
    if (conn.seat !== null) {
      const stillHere = [...this.connections].some((c) => c.seat === conn.seat);
      if (!stillHere) this.setConnected(conn.seat, false);
    }
    this.broadcast();
  }

  private setConnected(seat: number, connected: boolean): void {
    const slot = this.seats[seat];
    if (slot.player) slot.player.connected = connected;
    if (this.state) this.state.players[seat].connected = connected;
  }

  takeSeat(conn: Connection, name: string): void {
    if (conn.seat !== null) return;
    const idx = this.seats.findIndex((s) => s.player === null);
    if (idx < 0) throw new Error('Game is full');
    if (this.state) throw new Error('Game already started');
    this.seats[idx] = {
      player: { name: name.slice(0, 20) || `Player ${idx + 1}`, isBot: false, connected: true },
      token: conn.token
    };
    conn.seat = idx;
  }

  addBot(): void {
    if (this.state) throw new Error('Game already started');
    const idx = this.seats.findIndex((s) => s.player === null);
    if (idx < 0) throw new Error('Game is full');
    const names = ['Botrick', 'Bothilda', 'Robotham'];
    const used = this.seats.filter((s) => s.player?.isBot).length;
    this.seats[idx] = {
      player: { name: names[used % names.length], isBot: true, connected: true },
      token: null
    };
  }

  removeBot(): void {
    if (this.state) throw new Error('Game already started');
    for (let i = this.seats.length - 1; i >= 0; i--) {
      if (this.seats[i].player?.isBot) {
        this.seats[i] = { player: null, token: null };
        return;
      }
    }
  }

  start(): void {
    if (this.state) throw new Error('Game already started');
    if (this.seats.some((s) => s.player === null)) throw new Error('Seats still open');
    this.state = newGame(
      this.config,
      this.seats.map((s) => s.player!)
    );
    startNextHand(this.state);
    this.afterChange();
  }

  bid(seat: number, bid: number): void {
    if (!this.state) throw new Error('Game not started');
    placeBid(this.state, seat, bid);
    this.afterChange();
  }

  play(seat: number, cardId: string): void {
    if (!this.state) throw new Error('Game not started');
    playCard(this.state, seat, cardId);
    this.afterChange();
  }

  continueGame(): void {
    if (!this.state) throw new Error('Game not started');
    if (this.state.phase !== 'handEnd') throw new Error('Nothing to continue');
    startNextHand(this.state);
    this.afterChange();
  }

  /** After any state change: broadcast, then schedule bot moves / trick sweeps. */
  private afterChange(): void {
    this.lastActivity = Date.now();
    this.generation++;
    const gen = this.generation;
    this.broadcast();
    const state = this.state;
    if (!state) return;

    // Leaderboard: record finished games once, human-only games count.
    if (state.phase === 'gameEnd' && !this.resultRecorded) {
      this.resultRecorded = true;
      if (state.players.every((p) => !p.isBot)) {
        recordGame(this.code, state).catch((err) =>
          console.error('Failed to record game result:', err)
        );
      }
    }

    if (state.trickWinner !== null) {
      setTimeout(() => {
        if (gen !== this.generation || !this.state) return;
        collectTrick(this.state);
        this.afterChange();
      }, TRICK_PAUSE_MS);
      return;
    }

    if (state.turn >= 0 && state.players[state.turn].isBot) {
      setTimeout(() => {
        if (gen !== this.generation || !this.state) return;
        const s = this.state;
        const seat = s.turn;
        if (seat < 0 || !s.players[seat].isBot) return;
        if (s.phase === 'bidding') {
          placeBid(s, seat, chooseBid(s, seat));
        } else if (s.phase === 'playing') {
          playCard(s, seat, chooseCard(s, seat).id);
        }
        this.afterChange();
      }, BOT_THINK_MS);
    }
  }

  broadcast(): void {
    for (const conn of this.connections) {
      try {
        conn.ws.send(JSON.stringify(this.viewFor(conn)));
      } catch {
        // socket already closing; dropConnection will clean up
      }
    }
  }

  /** Build the personalized, private-info-safe view for one connection. */
  viewFor(conn: Connection): object {
    const isHost = conn.token === this.hostToken;
    const base = {
      type: 'state' as const,
      roomCode: this.code,
      seat: conn.seat,
      isHost,
      config: this.config,
      seats: this.seats.map((s) => s.player)
    };
    const state = this.state;
    if (!state) return { ...base, phase: 'lobby' };

    return {
      ...base,
      phase: state.phase,
      handIndex: state.handIndex,
      handNumber: state.handIndex + 1,
      handCount: HAND_SIZES.length,
      handSize: state.handSize,
      dealer: state.dealer,
      trumpCard: state.trumpCard,
      players: state.players.map((p, i) => ({
        name: p.name,
        isBot: p.isBot,
        connected: p.connected,
        bid: state.bids[i],
        tricksTaken: state.tricksTaken[i],
        score: state.scores[i],
        cardsLeft: state.hands[i].length
      })),
      turn: state.turn,
      trick: state.trick,
      trickWinner: state.trickWinner,
      lastTrick: state.lastTrick,
      history: state.history,
      hand: conn.seat !== null ? sortHand(state.hands[conn.seat]) : null,
      legalBids: conn.seat !== null ? legalBids(state, conn.seat) : [],
      legalPlays: conn.seat !== null ? legalPlays(state, conn.seat).map((c) => c.id) : []
    };
  }
}

const SUIT_ORDER = { S: 0, H: 1, C: 2, D: 3 } as const;

function sortHand<T extends { suit: keyof typeof SUIT_ORDER; rank: number }>(hand: T[]): T[] {
  return hand
    .slice()
    .sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || b.rank - a.rank);
}
