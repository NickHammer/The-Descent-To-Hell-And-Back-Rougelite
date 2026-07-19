/**
 * Drives one hand of Oh Hell entirely in the browser: the shared engine holds
 * the state, ai.ts plays the demons on timers, and the player acts through
 * bid()/play(). No server involved.
 */
import { useEffect, useRef, useState } from 'react';
import { chooseBid, chooseCard } from '../../shared/ai.js';
import {
  collectTrick,
  legalBids,
  legalPlays,
  newGame,
  placeBid,
  playCard,
  startNextHand
} from '../../shared/engine.js';
import { Card, GameState, PlayerInfo, Suit } from '../../shared/types.js';
import { DEMONS, DemonSeat, rosterFor } from '../../rogue/demons.js';
import { StopDef } from '../../rogue/run.js';
import { mulberry32, pick } from '../../rogue/rng.js';
import { play as playSound } from '../sounds.js';

const DEMON_THINK_MS = 750;
const TRICK_PAUSE_MS = 2600;
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export interface LocalHand {
  state: GameState;
  /** roster index for each demon seat (seat 1..n), living demons only */
  seatRoster: number[];
  /** the roster entry behind each demon seat, aligned with seatRoster */
  seatDemons: DemonSeat[];
  /** each demon seat's remaining cards (local — shown only as backs) */
  demonHands: Card[][];
  /** player's legal bids / plays (empty when it isn't your turn) */
  legalBids: number[];
  legalPlays: string[];
  sortedHand: Card[];
  trumpsPlayed: number;
  /** set when the Adversary shifts the trump, cleared on the next trick */
  trumpShifted: boolean;
  /** the most recent bid placed, so the table can announce it */
  lastBid: { seat: number; bid: number } | null;
  result: { bid: number; taken: number } | null;
  bid: (b: number) => void;
  play: (cardId: string) => void;
  /** collapse the timers for the rest of the hand (used once the bid is dead) */
  hurry: () => void;
  hurrying: boolean;
}

export function useLocalHand(
  stop: StopDef,
  demonHps: number[],
  playerName: string,
  seed: number
): LocalHand {
  const roster = rosterFor(stop);
  const aliveRoster = demonHps
    .map((hp, i) => (hp > 0 ? i : -1))
    .filter((i) => i >= 0);
  const leadAliveNow = demonHps[0] > 0;
  const style = leadAliveNow ? DEMONS[stop.demonId].style : {};
  const game = useRef<GameState | null>(null);
  const rng = useRef<() => number>(() => Math.random());
  const trumps = useRef(0);
  const shifted = useRef(false);
  const lastBid = useRef<{ seat: number; bid: number } | null>(null);
  const fast = useRef(false);
  const [, setVersion] = useState(0);

  if (game.current === null) {
    rng.current = mulberry32(seed);
    const seatCount = aliveRoster.length + 1;
    const players: PlayerInfo[] = Array.from({ length: seatCount }, (_, i) => ({
      name: i === 0 ? playerName || 'You' : roster[aliveRoster[i - 1]].name,
      isBot: i > 0,
      connected: true
    }));
    const state = newGame({ seatCount, maxHandSize: stop.handSize, hookRule: false }, players);
    state.handIndex = stop.handSize - 2; // startNextHand advances to a stop.handSize-card hand
    // Randomize who deals so the player isn't always last to bid
    // (startNextHand rotates once, which keeps the draw uniform).
    state.dealer = Math.floor(rng.current() * seatCount);
    startNextHand(state, rng.current);
    game.current = state;
    playSound('deal');
  }

  const bump = () => setVersion((v) => v + 1);
  const state = game.current;
  const handOver = state.phase === 'handEnd' || state.phase === 'gameEnd';

  // Demon turns and trick collection run on timers, exactly like the server does.
  useEffect(() => {
    if (handOver) return;

    if (state.trickWinner !== null) {
      const timer = window.setTimeout(
        () => {
        collectTrick(state);
        shifted.current = false;
        // The Adversary shifts the trump every 3 collected tricks (if the hand goes on).
        const collected = state.tricksTaken.reduce((a, b) => a + b, 0);
        if (
          stop.demonId === 'adversary' &&
          leadAliveNow &&
          state.phase === 'playing' &&
          collected % 3 === 0 &&
          state.trumpCard
        ) {
          const others = SUITS.filter((s) => s !== state.trumpCard!.suit);
          const suit = pick(rng.current, others);
          state.trumpCard = { ...state.trumpCard, suit, id: `shift-${suit}-${collected}` };
          shifted.current = true;
        }
          bump();
        },
        fast.current ? 130 : TRICK_PAUSE_MS
      );
      return () => clearTimeout(timer);
    }

    if (state.turn > 0) {
      const timer = window.setTimeout(
        () => {
          const seat = state.turn;
          if (seat <= 0) return;
          if (state.phase === 'bidding') {
            const demonBid = chooseBid(state, seat, style, rng.current);
            placeBid(state, seat, demonBid);
            lastBid.current = { seat, bid: demonBid };
          } else if (state.phase === 'playing') {
            const card = chooseCard(state, seat, style);
            if (card.suit === state.trumpCard!.suit) trumps.current += 1;
            playCard(state, seat, card.id);
            if (!fast.current) playSound('card');
          }
          if (state.trickWinner !== null && !fast.current) playSound('trick');
          bump();
        },
        fast.current ? 70 : DEMON_THINK_MS
      );
      return () => clearTimeout(timer);
    }

    if (state.turn === 0) playSound('turn');
  });

  const bid = (b: number) => {
    if (state.turn !== 0 || state.phase !== 'bidding') return;
    placeBid(state, 0, b);
    lastBid.current = { seat: 0, bid: b };
    bump();
  };

  const play = (cardId: string) => {
    if (state.turn !== 0 || state.phase !== 'playing') return;
    const card = state.hands[0].find((c) => c.id === cardId);
    if (!card || !legalPlays(state, 0).some((c) => c.id === cardId)) return;
    if (card.suit === state.trumpCard!.suit) trumps.current += 1;
    playCard(state, 0, cardId);
    playSound('card');
    if (state.trickWinner !== null) playSound('trick');
    bump();
  };

  return {
    state,
    seatRoster: aliveRoster,
    seatDemons: aliveRoster.map((i) => roster[i]),
    demonHands: state.hands.slice(1),
    legalBids: legalBids(state, 0),
    legalPlays: legalPlays(state, 0).map((c) => c.id),
    sortedHand: sortHand(state.hands[0]),
    trumpsPlayed: trumps.current,
    trumpShifted: shifted.current,
    lastBid: lastBid.current,
    result: handOver ? { bid: state.history[0].bids[0], taken: state.history[0].taken[0] } : null,
    bid,
    play,
    hurry: () => {
      fast.current = true;
      bump();
    },
    hurrying: fast.current
  };
}

const BLACKS: Suit[] = ['S', 'C'];
const REDS: Suit[] = ['H', 'D'];

/** Same alternating-color sort the multiplayer server uses. */
function sortHand(hand: Card[]): Card[] {
  const present = new Set(hand.map((c) => c.suit));
  const blacks = BLACKS.filter((s) => present.has(s));
  const reds = REDS.filter((s) => present.has(s));
  const [first, second] = blacks.length >= reds.length ? [blacks, reds] : [reds, blacks];
  const order = new Map<Suit, number>();
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (i < first.length) order.set(first[i], order.size);
    if (i < second.length) order.set(second[i], order.size);
  }
  return hand
    .slice()
    .sort((a, b) => order.get(a.suit)! - order.get(b.suit)! || b.rank - a.rank);
}

export const DEMON_INFO = DEMONS;
