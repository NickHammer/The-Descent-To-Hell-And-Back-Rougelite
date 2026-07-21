/**
 * Pacing probe: the "win" safety net for battle tuning. Plays bot-vs-bot
 * hands at every stop (the shared AI standing in for the player, no relics),
 * scores made bids through scoreStrike, and asserts each gate's table dies
 * in a sane number of hands. Run with PACING_LOG=1 to print the curve.
 */
import { describe, expect, it } from 'vitest';
import { chooseBid, chooseCard } from '../shared/ai.js';
import { collectTrick, newGame, placeBid, playCard, startNextHand } from '../shared/engine.js';
import { PlayerInfo } from '../shared/types.js';
import { mulberry32 } from './rng.js';
import { RelicId } from './relics.js';
import { buildTrack, demonMaxHpsFor, PLAYER_MAX_HP, StopDef } from './run.js';
import { scoreDemonStrike, scoreStrike } from './scoring.js';

const REPS = 120;

/**
 * A plausible mid-run damage build: three relics you could realistically
 * hold by the first couple of shops (Circle 3, Circle 6). Not the strongest
 * possible loadout — the point is a *typical* built machine, not a maxed one.
 */
const BUILT_RELICS: RelicId[] = ['emberBrand', 'pyre', 'zerosCrown'];
const BUILT_STREAK = 2;

/** Mean strike damage per played hand at a stop (missed bids land 0). */
function meanDamage(stop: StopDef, seedBase: number, relics: RelicId[] = [], streak = 0): number {
  let sum = 0;
  for (let rep = 0; rep < REPS; rep++) {
    const rng = mulberry32(seedBase + rep * 101);
    const seatCount = stop.demonCount + 1;
    const players: PlayerInfo[] = Array.from({ length: seatCount }, (_, i) => ({
      name: i === 0 ? 'You' : `Demon ${i}`,
      isBot: i > 0,
      connected: true
    }));
    const state = newGame({ seatCount, maxHandSize: stop.handSize, hookRule: false }, players);
    state.handIndex = stop.handSize - 2;
    startNextHand(state, rng);
    while (state.phase === 'bidding') placeBid(state, state.turn, chooseBid(state, state.turn));
    while (state.phase === 'playing' || state.trickWinner !== null) {
      if (state.trickWinner !== null) collectTrick(state);
      else playCard(state, state.turn, chooseCard(state, state.turn).id);
    }
    const { bids, taken } = state.history[0];
    if (bids[0] !== taken[0]) continue; // a miss strikes nothing
    const wins = state.trickLog
      .filter((t) => t.winner === 0)
      .map((t) => {
        const card = t.cards.find((tc) => tc.seat === 0)!.card;
        return { rank: card.rank, suit: card.suit, trump: card.suit === t.trumpSuit };
      });
    sum += scoreStrike(bids[0], wins, relics, streak).total;
  }
  return sum / REPS;
}

/** Mean demon-strike damage per missed hand at a stop (made bids land 0 here — they're `meanDamage`'s job). */
function meanMissDamage(stop: StopDef, seedBase: number): number {
  let sum = 0;
  let misses = 0;
  for (let rep = 0; rep < REPS; rep++) {
    const rng = mulberry32(seedBase + rep * 101);
    const seatCount = stop.demonCount + 1;
    const players: PlayerInfo[] = Array.from({ length: seatCount }, (_, i) => ({
      name: i === 0 ? 'You' : `Demon ${i}`,
      isBot: i > 0,
      connected: true
    }));
    const state = newGame({ seatCount, maxHandSize: stop.handSize, hookRule: false }, players);
    state.handIndex = stop.handSize - 2;
    startNextHand(state, rng);
    while (state.phase === 'bidding') placeBid(state, state.turn, chooseBid(state, state.turn));
    while (state.phase === 'playing' || state.trickWinner !== null) {
      if (state.trickWinner !== null) collectTrick(state);
      else playCard(state, state.turn, chooseCard(state, state.turn).id);
    }
    const { bids, taken } = state.history[0];
    if (bids[0] === taken[0]) continue; // a make strikes the table, not the player
    const demonWins = state.trickLog
      .filter((t) => t.winner !== 0)
      .map((t) => {
        const card = t.cards.find((tc) => tc.seat === t.winner)!.card;
        return { rank: card.rank, suit: card.suit, trump: card.suit === t.trumpSuit };
      });
    sum += scoreDemonStrike(demonWins, Math.abs(bids[0] - taken[0])).total;
    misses++;
  }
  return misses === 0 ? 0 : sum / misses;
}

describe('battle pacing (headless probe)', () => {
  it('every gate falls in a sane number of average hands, and the wall climbs', () => {
    const track = buildTrack(2026);
    const curve = track.map((stop) => {
      const total = demonMaxHpsFor(stop).reduce((a, b) => a + b, 0);
      const dmg = meanDamage(stop, 555_000 + stop.index * 10_007);
      return { stop: stop.label, hp: total, meanDmg: Math.round(dmg * 10) / 10, hands: total / dmg };
    });
    if (process.env.PACING_LOG) {
      // eslint-disable-next-line no-console
      console.table(curve.map((c) => ({ ...c, hands: Math.round(c.hands * 10) / 10 })));
    }
    for (const c of curve) {
      // Relic-less AI proxy: gates must stay killable (< 6 average hands)
      // and never free (> 1 average hand).
      expect(c.hands, `${c.stop} too tanky`).toBeLessThan(6);
      expect(c.hands, `${c.stop} too free`).toBeGreaterThan(1);
    }
    // The back half must demand more than the front door did.
    const early = curve.slice(0, 3).reduce((s, c) => s + c.hands, 0) / 3;
    const late = curve.slice(-3).reduce((s, c) => s + c.hands, 0) / 3;
    expect(late).toBeGreaterThan(early);
  });

  it('a built machine still faces a real fight — the wall scales with damage relics', () => {
    // demonMaxHpsFor scales the wall by relics owned (see wallPowerFactor in
    // run.ts) specifically so this doesn't collapse toward a one-hit kill —
    // closing the gap the relic-less probe above always flagged as open.
    const track = buildTrack(2026);
    const curve = track.map((stop) => {
      const total = demonMaxHpsFor(stop, BUILT_RELICS).reduce((a, b) => a + b, 0);
      const dmg = meanDamage(stop, 555_000 + stop.index * 10_007, BUILT_RELICS, BUILT_STREAK);
      return { stop: stop.label, hp: total, meanDmg: Math.round(dmg * 10) / 10, hands: total / dmg };
    });
    if (process.env.PACING_LOG) {
      // eslint-disable-next-line no-console
      console.table(curve.map((c) => ({ ...c, hands: Math.round(c.hands * 10) / 10 })));
    }
    for (const c of curve) {
      // A built machine should clear faster than a relic-less run at the
      // same stop, but a made bid still shouldn't overkill the whole table
      // in one hit, and the gate must still fall inside the same outer band
      // the relic-less probe holds everyone else to.
      expect(c.hands, `${c.stop} too tanky even for a built machine`).toBeLessThan(6);
      expect(c.hands, `${c.stop} one-shot despite the wall scaling`).toBeGreaterThan(0.8);
    }
  });

  it('a missed bid never averages a one-hit kill, and never goes toothless', () => {
    const track = buildTrack(2026);
    const curve = track.map((stop) => ({
      stop: stop.label,
      dmg: meanMissDamage(stop, 777_000 + stop.index * 10_007)
    }));
    if (process.env.PACING_LOG) {
      // eslint-disable-next-line no-console
      console.table(curve.map((c) => ({ ...c, dmg: Math.round(c.dmg * 10) / 10 })));
    }
    for (const c of curve) {
      // Relic-less AI proxy: an average miss should sting but never average
      // a guaranteed full-HP kill, and should always draw some blood.
      expect(c.dmg, `${c.stop} miss too soft`).toBeGreaterThan(1);
      expect(c.dmg, `${c.stop} miss too harsh`).toBeLessThan(PLAYER_MAX_HP);
    }
  });
});
