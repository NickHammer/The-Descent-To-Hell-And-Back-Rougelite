import { describe, expect, it } from 'vitest';
import {
  BASE_CHIPS,
  CURSED_CHIPS_PENALTY,
  CURSED_DEMON_MULT,
  DEMON_BASE_CHIPS,
  DEMON_MULT_CAP,
  DEMON_MULT_PER_MISS,
  EMBER_BRAND_MULT,
  GILDED_CHIPS,
  LEDGER_CHIPS_PER_STREAK,
  LEDGER_STREAK_CAP,
  MARKED_MULT,
  MULT_PER_BID,
  PYRE_MULT_PER_TRUMP_WIN,
  scoreDemonStrike,
  scoreStrike,
  TrickWin,
  ZEROS_CROWN_MULT
} from './scoring.js';
import { Suit } from '../shared/types.js';

const win = (rank: number, trump = false, suit: Suit = 'S'): TrickWin => ({ rank, suit, trump });

describe('scoreStrike', () => {
  it('a made 0-bid lands the base chips at ×1', () => {
    expect(scoreStrike(0, [], [])).toEqual({
      baseChips: BASE_CHIPS,
      trickChips: 0,
      chips: BASE_CHIPS,
      mult: 1,
      total: BASE_CHIPS
    });
  });

  it('chips come from trick quality, mult from bid boldness', () => {
    const score = scoreStrike(3, [win(14), win(11), win(5)], []);
    expect(score.trickChips).toBe(30);
    expect(score.chips).toBe(BASE_CHIPS + 30);
    expect(score.mult).toBe(1 + 3 * MULT_PER_BID);
    expect(score.total).toBe(Math.round((BASE_CHIPS + 30) * 2.5)); // 100
  });

  it('rounds the product', () => {
    // (10 + 5) × 1.5 = 22.5 → 23
    expect(scoreStrike(1, [win(5)], []).total).toBe(23);
  });

  it('ember brand feeds the mult axis', () => {
    const plain = scoreStrike(2, [win(10)], []);
    const branded = scoreStrike(2, [win(10)], ['emberBrand']);
    expect(branded.mult).toBe(plain.mult + EMBER_BRAND_MULT);
    expect(branded.chips).toBe(plain.chips);
    expect(branded.total).toBeGreaterThan(plain.total);
  });

  it('the two axes multiply: the same chips hit harder on a bolder bid', () => {
    const wins = [win(12), win(9)];
    const meek = scoreStrike(2, wins, []);
    const bold = scoreStrike(4, wins, []);
    expect(bold.total - meek.total).toBe(Math.round(meek.chips * 2 * MULT_PER_BID));
  });

  it('pyre adds mult per trump trick won, not per trump played', () => {
    const plain = scoreStrike(2, [win(10, true), win(8, false)], []);
    const pyred = scoreStrike(2, [win(10, true), win(8, false)], ['pyre']);
    expect(pyred.mult).toBe(plain.mult + PYRE_MULT_PER_TRUMP_WIN); // one trump win
    expect(pyred.chips).toBe(plain.chips);
  });

  it("zero's crown replaces the ×1 base mult on a made 0-bid only", () => {
    const zeroCrowned = scoreStrike(0, [], ['zerosCrown']);
    expect(zeroCrowned.mult).toBe(ZEROS_CROWN_MULT);
    const oneCrowned = scoreStrike(1, [], ['zerosCrown']);
    expect(oneCrowned.mult).toBe(1 + MULT_PER_BID); // untouched off a 0-bid
  });

  it('herald of a suit doubles chips for tricks won in that suit only', () => {
    const wins = [win(10, false, 'H'), win(6, false, 'S')];
    const plain = scoreStrike(1, wins, []);
    const heralded = scoreStrike(1, wins, ['heraldHearts']);
    expect(heralded.trickChips).toBe(plain.trickChips + 10); // only the Hearts win doubles
  });

  it('ledger of wrath adds chips per consecutive made bid, gated on the relic', () => {
    const withoutRelic = scoreStrike(1, [], [], 3);
    expect(withoutRelic.chips).toBe(BASE_CHIPS);
    const withRelic = scoreStrike(1, [], ['ledgerOfWrath'], 3);
    expect(withRelic.chips).toBe(BASE_CHIPS + LEDGER_CHIPS_PER_STREAK * 3);
  });

  it("ledger of wrath's streak caps out instead of snowballing forever", () => {
    const atCap = scoreStrike(1, [], ['ledgerOfWrath'], LEDGER_STREAK_CAP);
    const overCap = scoreStrike(1, [], ['ledgerOfWrath'], LEDGER_STREAK_CAP + 20);
    expect(overCap.chips).toBe(atCap.chips);
    expect(atCap.chips).toBe(BASE_CHIPS + LEDGER_CHIPS_PER_STREAK * LEDGER_STREAK_CAP);
  });

  it('a gilded enchant adds flat chips when its card wins a trick', () => {
    const plain = scoreStrike(1, [win(4)], []);
    const gilded = scoreStrike(1, [{ ...win(4), enchant: 'gilded' }], []);
    expect(gilded.trickChips).toBe(plain.trickChips + GILDED_CHIPS);
  });

  it('a cursed enchant subtracts chips, floored at 0', () => {
    const cursed = scoreStrike(1, [{ ...win(4), enchant: 'cursed' }], []);
    expect(cursed.trickChips).toBe(Math.max(0, 4 - CURSED_CHIPS_PENALTY));
    const smallCursed = scoreStrike(1, [{ ...win(2), enchant: 'cursed' }], []);
    expect(smallCursed.trickChips).toBe(0); // never negative
  });

  it('a royal enchant scores as an ace regardless of its real rank', () => {
    const royal = scoreStrike(1, [{ ...win(2), enchant: 'royal' }], []);
    const ace = scoreStrike(1, [win(14)], []);
    expect(royal.trickChips).toBe(ace.trickChips);
  });

  it('royal and herald combine: it doubles as an ace, not as its real rank', () => {
    const royalHeralded = scoreStrike(1, [{ ...win(2, false, 'H'), enchant: 'royal' }], ['heraldHearts']);
    expect(royalHeralded.trickChips).toBe(28); // 14 × 2
  });

  it('a blazing enchant always counts as a trump win, feeding pyre', () => {
    const plain = scoreStrike(2, [{ ...win(5, false), enchant: 'blazing' }], []);
    const pyred = scoreStrike(2, [{ ...win(5, false), enchant: 'blazing' }], ['pyre']);
    expect(pyred.mult).toBe(plain.mult + PYRE_MULT_PER_TRUMP_WIN);
  });

  it('a marked enchant adds mult directly, no relic required', () => {
    const plain = scoreStrike(1, [win(5)], []);
    const marked = scoreStrike(1, [{ ...win(5), enchant: 'marked' }], []);
    expect(marked.mult).toBe(plain.mult + MARKED_MULT);
    expect(marked.chips).toBe(plain.chips);
  });
});

describe('scoreDemonStrike', () => {
  const demonWin = (rank = 2): TrickWin => ({ rank, suit: 'C', trump: false });

  it('chips count tricks the demons won, not their rank sum', () => {
    const score = scoreDemonStrike([demonWin(14), demonWin(2)], 0);
    expect(score.trickChips).toBe(2); // a count, not 16
    expect(score.chips).toBe(DEMON_BASE_CHIPS + 2);
    expect(score.mult).toBe(1);
    expect(score.total).toBe(score.chips);
  });

  it('mult climbs with how badly you missed, capped', () => {
    const close = scoreDemonStrike([demonWin()], 1);
    const wild = scoreDemonStrike([demonWin()], 20);
    expect(close.mult).toBe(1 + DEMON_MULT_PER_MISS);
    expect(wild.mult).toBe(DEMON_MULT_CAP);
    expect(wild.total).toBeGreaterThan(close.total);
  });

  it('no demon-won tricks still lands the base chips', () => {
    const score = scoreDemonStrike([], 0);
    expect(score.total).toBe(DEMON_BASE_CHIPS);
  });

  it('a cursed card won by a demon adds to the table mult, capped the same way', () => {
    const plain = scoreDemonStrike([demonWin()], 0);
    const cursed = scoreDemonStrike([{ ...demonWin(), enchant: 'cursed' }], 0);
    expect(cursed.mult).toBe(plain.mult + CURSED_DEMON_MULT);
    const capped = scoreDemonStrike(
      [{ ...demonWin(), enchant: 'cursed' }, { ...demonWin(), enchant: 'cursed' }],
      20
    );
    expect(capped.mult).toBe(DEMON_MULT_CAP);
  });
});
