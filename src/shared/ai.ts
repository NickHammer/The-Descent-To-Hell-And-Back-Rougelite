import { legalBids, legalPlays, trickWinnerIndex } from './engine.js';
import { Card, GameState, Suit } from './types.js';

/**
 * Rough chance a single card wins a trick, used to estimate a bid.
 * Trumps are strong at any rank; off-suit cards only matter near the top.
 */
function cardStrength(card: Card, trump: Suit): number {
  if (card.suit === trump) {
    return 0.5 + ((card.rank - 2) / 12) * 0.45; // 0.5 (2) .. 0.95 (A)
  }
  if (card.rank === 14) return 0.7;
  if (card.rank === 13) return 0.45;
  if (card.rank === 12) return 0.2;
  return 0.05;
}

export function chooseBid(state: GameState, seat: number): number {
  const hand = state.hands[seat];
  const trump = state.trumpCard!.suit;
  const estimate = Math.round(hand.reduce((sum, c) => sum + cardStrength(c, trump), 0));

  const legal = legalBids(state, seat);
  if (legal.includes(estimate)) return estimate;
  // Hook rule blocked the estimate: take the nearest legal bid, preferring lower.
  let best = legal[0];
  for (const b of legal) {
    const better =
      Math.abs(b - estimate) < Math.abs(best - estimate) ||
      (Math.abs(b - estimate) === Math.abs(best - estimate) && b < best);
    if (better) best = b;
  }
  return best;
}

function byRank(a: Card, b: Card): number {
  return a.rank - b.rank;
}

/** Would playing `card` take the lead in the current (partial) trick? */
function wouldWin(state: GameState, seat: number, card: Card): boolean {
  const trial = [...state.trick, { seat, card }];
  return trickWinnerIndex(trial, state.trumpCard!.suit) === seat;
}

export function chooseCard(state: GameState, seat: number): Card {
  const legal = legalPlays(state, seat).slice().sort(byRank);
  const trump = state.trumpCard!.suit;
  const wantsTricks = state.tricksTaken[seat] < (state.bids[seat] ?? 0);

  if (state.trick.length === 0) {
    // Leading.
    if (wantsTricks) {
      // Lead our best chance: a boss off-suit card, else our highest trump, else highest.
      const offAces = legal.filter((c) => c.suit !== trump && c.rank === 14);
      if (offAces.length > 0) return offAces[0];
      const trumps = legal.filter((c) => c.suit === trump);
      if (trumps.length > 0) return trumps[trumps.length - 1];
      return legal[legal.length - 1];
    }
    return legal[0]; // dump our weakest lead
  }

  const winners = legal.filter((c) => wouldWin(state, seat, c));
  const losers = legal.filter((c) => !wouldWin(state, seat, c));

  if (wantsTricks) {
    // Cheapest card that currently wins the trick, preferring non-trump wins.
    if (winners.length > 0) {
      const offSuitWinners = winners.filter((c) => c.suit !== trump);
      return offSuitWinners[0] ?? winners[0];
    }
    return losers[0]; // can't win: throw our lowest
  }

  // At or over our bid: try hard not to take this trick.
  if (losers.length > 0) return losers[losers.length - 1]; // shed the biggest safe card
  return winners[0]; // forced to win: do it as cheaply as possible
}
