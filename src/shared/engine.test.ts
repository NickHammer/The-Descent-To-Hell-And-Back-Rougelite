import { describe, expect, it } from 'vitest';
import { chooseBid, chooseCard } from './ai.js';
import {
  buildDeck,
  collectTrick,
  legalBids,
  legalPlays,
  newGame,
  placeBid,
  playCard,
  startNextHand,
  trickWinnerIndex
} from './engine.js';
import { Card, GameConfig, GameState, HAND_SIZES, PlayerInfo, Suit } from './types.js';

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGame(seatCount: number, hookRule = false): GameState {
  const config: GameConfig = { seatCount, hookRule };
  const players: PlayerInfo[] = Array.from({ length: seatCount }, (_, i) => ({
    name: `P${i}`,
    isBot: true,
    connected: true
  }));
  return newGame(config, players);
}

function card(suit: Suit, rank: number): Card {
  return { suit, rank, id: `${suit}${rank}` };
}

describe('deck', () => {
  it('has 52 unique cards', () => {
    const deck = buildDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });
});

describe('dealing', () => {
  it('deals hand sizes 1..10..1 and rotates the dealer', () => {
    const rng = makeRng(42);
    const state = makeGame(3);
    startNextHand(state, rng);
    expect(state.handSize).toBe(1);
    expect(state.dealer).toBe(0);
    expect(state.hands.every((h) => h.length === 1)).toBe(true);
    expect(state.trumpCard).not.toBeNull();
    expect(state.turn).toBe(1); // left of dealer bids first
  });

  it('deals distinct cards and trump is not in any hand', () => {
    const rng = makeRng(7);
    const state = makeGame(4);
    // Jump to a 10-card hand for maximum overlap risk.
    state.handIndex = 8;
    state.phase = 'handEnd';
    startNextHand(state, rng);
    expect(state.handSize).toBe(10);
    const all = state.hands.flat().map((c) => c.id);
    all.push(state.trumpCard!.id);
    expect(new Set(all).size).toBe(41);
  });
});

describe('bidding', () => {
  it('dealer bids last and hook rule blocks an even book on the way down', () => {
    const rng = makeRng(1);
    const state = makeGame(2, true);
    state.handIndex = 12; // next hand will be index 13 → 6 cards, descending
    state.phase = 'handEnd';
    startNextHand(state, rng);
    expect(state.handSize).toBe(6);
    const dealer = state.dealer;
    const other = (dealer + 1) % 2;
    expect(state.turn).toBe(other);
    placeBid(state, other, 2);
    // Dealer may not bid 4 (2 + 4 === 6 tricks).
    const dealerBids = legalBids(state, dealer);
    expect(dealerBids).not.toContain(4);
    expect(dealerBids).toContain(3);
    placeBid(state, dealer, 3);
    expect(state.phase).toBe('playing');
    expect(state.turn).toBe((dealer + 1) % 2);
  });

  it('hook rule does not restrict the way up, including the 10-card peak', () => {
    const rng = makeRng(2);
    const state = makeGame(2, true);
    startNextHand(state, rng); // hand index 0: 1 card, ascending
    placeBid(state, state.turn, 1);
    expect(legalBids(state, state.dealer)).toEqual([0, 1]);

    const peak = makeGame(2, true);
    peak.handIndex = 8; // next hand: index 9 → the 10-card peak
    peak.phase = 'handEnd';
    startNextHand(peak, rng);
    expect(peak.handSize).toBe(10);
    placeBid(peak, peak.turn, 4);
    expect(legalBids(peak, peak.dealer)).toContain(6); // 4 + 6 = 10 is fine at the peak
  });

  it('without hook rule all bids are legal even on the way down', () => {
    const rng = makeRng(1);
    const state = makeGame(2, false);
    state.handIndex = 17; // next hand: index 18 → final 1-card hand
    state.phase = 'handEnd';
    startNextHand(state, rng);
    placeBid(state, state.turn, 1);
    expect(legalBids(state, state.dealer)).toEqual([0, 1]);
  });
});

describe('trick resolution', () => {
  it('highest of led suit wins when no trump is played', () => {
    const trick = [
      { seat: 0, card: card('H', 5) },
      { seat: 1, card: card('H', 13) },
      { seat: 2, card: card('C', 14) } // slough, does not win
    ];
    expect(trickWinnerIndex(trick, 'S')).toBe(1);
  });

  it('any trump beats the led suit, highest trump wins', () => {
    const trick = [
      { seat: 0, card: card('H', 14) },
      { seat: 1, card: card('S', 2) },
      { seat: 2, card: card('S', 9) }
    ];
    expect(trickWinnerIndex(trick, 'S')).toBe(2);
  });

  it('must follow suit when able', () => {
    const rng = makeRng(3);
    const state = makeGame(2);
    startNextHand(state, rng);
    placeBid(state, state.turn, 0);
    placeBid(state, state.turn, 0);
    // Rig hands for a deterministic check.
    state.hands[state.turn] = [card('H', 5), card('C', 9)];
    state.hands[(state.turn + 1) % 2] = [card('H', 7), card('S', 3)];
    const leader = state.turn;
    const follower = (leader + 1) % 2;
    playCard(state, leader, 'H5');
    expect(legalPlays(state, follower).map((c) => c.id)).toEqual(['H7']);
    expect(() => playCard(state, follower, 'S3')).toThrow();
    playCard(state, follower, 'H7');
    expect(state.trickWinner).toBe(follower);
    expect(state.turn).toBe(-1);
  });
});

describe('scoring', () => {
  it('awards bid+5 for an exact bid and -(bid+5) for a miss', () => {
    const rng = makeRng(9);
    const state = makeGame(2);
    startNextHand(state, rng); // 1-card hand
    const first = state.turn;
    placeBid(state, first, 1);
    placeBid(state, state.turn, 1);
    playCard(state, state.turn, state.hands[state.turn][0].id);
    playCard(state, state.turn, state.hands[state.turn][0].id);
    collectTrick(state);
    const winner = state.lastTrick!.winner;
    const loser = (winner + 1) % 2;
    expect(state.scores[winner]).toBe(6); // bid 1, took 1 → +(1+5)
    expect(state.scores[loser]).toBe(-6); // bid 1, took 0 → -(1+5)
    expect(state.phase).toBe('handEnd');
  });

  it('scores the examples from the rules: bid 3 made is +8, bid 2 missed is -7', () => {
    const rng = makeRng(11);
    const state = makeGame(2);
    state.handIndex = 3; // next hand: 5 cards
    state.phase = 'handEnd';
    startNextHand(state, rng);
    // Rig the last trick of the hand: seat 0 wins it to land exactly on its bid.
    state.bids = [3, 2];
    state.tricksTaken = [2, 1];
    state.hands = [[], []];
    state.trick = [
      { seat: 0, card: card('H', 9) },
      { seat: 1, card: card('H', 5) }
    ];
    state.trickWinner = 0;
    collectTrick(state);
    expect(state.tricksTaken).toEqual([3, 1]);
    expect(state.scores[0]).toBe(8); // bid 3, took 3 → +(3+5)
    expect(state.scores[1]).toBe(-7); // bid 2, took 1 → -(2+5)
  });
});

describe('full games with AI', () => {
  it.each([2, 3, 4])('plays all 19 hands cleanly with %i bots', (seatCount) => {
    const rng = makeRng(1000 + seatCount);
    const state = makeGame(seatCount, true);
    while (state.phase !== 'gameEnd') {
      startNextHand(state, rng);
      while (state.phase === 'bidding') {
        placeBid(state, state.turn, chooseBid(state, state.turn));
      }
      if (state.config.hookRule && state.handIndex >= 10) {
        const total = state.bids.reduce<number>((s, b) => s + b!, 0);
        expect(total).not.toBe(state.handSize);
      }
      while (state.phase === 'playing') {
        while (state.trickWinner === null) {
          playCard(state, state.turn, chooseCard(state, state.turn).id);
        }
        collectTrick(state);
      }
      const totalTaken = state.tricksTaken.reduce((a, b) => a + b, 0);
      expect(totalTaken).toBe(state.handSize);
    }
    expect(state.history.length).toBe(HAND_SIZES.length);
    // Every hand's points must be exactly ±(bid + 5).
    for (const hand of state.history) {
      hand.points.forEach((p, seat) => {
        const expected = hand.bids[seat] === hand.taken[seat] ? hand.bids[seat] + 5 : -(hand.bids[seat] + 5);
        expect(p).toBe(expected);
      });
    }
  });
});
