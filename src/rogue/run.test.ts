import { describe, expect, it } from 'vitest';
import { chooseBid, chooseCard } from '../shared/ai.js';
import { collectTrick, newGame, placeBid, playCard, startNextHand } from '../shared/engine.js';
import { PlayerInfo } from '../shared/types.js';
import { mulberry32 } from './rng.js';
import {
  BOTTOM_INDEX,
  buildTrack,
  buyHeal,
  buyRelic,
  leaveShop,
  newRun,
  resolveHand,
  RunState,
  soulsForClear,
  STOP_COUNT,
  StopDef,
  useFerrymansCoin
} from './run.js';

describe('track', () => {
  it('builds 19 stops shaped 1..10..1 with the boss at the bottom', () => {
    const track = buildTrack(123);
    expect(track.length).toBe(STOP_COUNT);
    expect(track.map((s) => s.handSize)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(track[BOTTOM_INDEX].demonId).toBe('adversary');
    expect(track[BOTTOM_INDEX].region).toBe('bottom');
    expect(track.filter((s) => s.region === 'hell').length).toBe(9);
    expect(track.filter((s) => s.region === 'heaven').length).toBe(9);
    // shops after every third stop, never after the last
    expect(track.filter((s) => s.shopAfter).map((s) => s.index)).toEqual([2, 5, 8, 11, 14, 17]);
    // demons respect their minimum depth
    expect(track[0].demonId).toBe('imp'); // only demon allowed at stop 0
  });

  it('is deterministic for a seed', () => {
    expect(buildTrack(42)).toEqual(buildTrack(42));
    expect(buildTrack(42).map((s) => s.demonId)).not.toEqual(buildTrack(43).map((s) => s.demonId));
  });
});

describe('resolution', () => {
  const track = buildTrack(7);

  it('made bid advances and pays souls', () => {
    const run = newRun(7);
    const next = resolveHand(run, track, { bid: 1, taken: 1 });
    expect(next.stopIndex).toBe(1);
    expect(next.souls).toBe(soulsForClear(1, false));
    expect(next.phase).toBe('map');
    expect(next.attempts).toBe(1);
  });

  it('missed bid costs grace and retries the same stop', () => {
    const run = newRun(7);
    const next = resolveHand(run, track, { bid: 1, taken: 0 });
    expect(next.stopIndex).toBe(0);
    expect(next.grace).toBe(2);
    expect(next.phase).toBe('map');
  });

  it('the usurer takes double grace', () => {
    const run: RunState = { ...newRun(7), stopIndex: 6 };
    const usurerTrack: StopDef[] = track.map((s, i) =>
      i === 6 ? { ...s, demonId: 'usurer' as const } : s
    );
    const next = resolveHand(run, usurerTrack, { bid: 2, taken: 4 });
    expect(next.grace).toBe(1);
  });

  it('cracked halo forgives a miss-by-one but pays nothing', () => {
    const run: RunState = { ...newRun(7), relics: ['crackedHalo'] };
    const next = resolveHand(run, track, { bid: 1, taken: 0 });
    expect(next.grace).toBe(3);
    expect(next.souls).toBe(0);
    expect(next.stopIndex).toBe(0);
    // a miss by two still hurts
    const worse = resolveHand(run, track, { bid: 1, taken: 3 });
    expect(worse.grace).toBe(2);
  });

  it('dies at zero grace', () => {
    let run: RunState = { ...newRun(7), grace: 1 };
    run = resolveHand(run, track, { bid: 0, taken: 1 });
    expect(run.phase).toBe('dead');
    expect(run.grace).toBe(0);
  });

  it('opens a shop after stop 2 and wins after the last stop', () => {
    let run: RunState = { ...newRun(7), stopIndex: 2 };
    run = resolveHand(run, track, { bid: 0, taken: 0 });
    expect(run.phase).toBe('shop');
    expect(run.shopOffers.length).toBeGreaterThan(0);
    run = leaveShop(run);
    expect(run.phase).toBe('map');
    expect(run.stopIndex).toBe(3);

    let last: RunState = { ...newRun(7), stopIndex: STOP_COUNT - 1 };
    last = resolveHand(last, track, { bid: 1, taken: 1 });
    expect(last.phase).toBe('won');
  });
});

describe('shop', () => {
  const track = buildTrack(11);

  function atShop(souls: number): RunState {
    let run: RunState = { ...newRun(11), stopIndex: 2, souls };
    run = resolveHand(run, track, { bid: 0, taken: 0 });
    expect(run.phase).toBe('shop');
    return run;
  }

  it('sells relics and applies second soul immediately', () => {
    let run = atShop(50);
    const offer = run.shopOffers[0];
    const before = run.souls;
    run = buyRelic(run, offer);
    expect(run.relics).toContain(offer);
    expect(run.souls).toBeLessThan(before);
    expect(run.shopOffers).not.toContain(offer);

    if (!run.relics.includes('secondSoul') && run.shopOffers.includes('secondSoul')) {
      const grace = run.grace;
      run = { ...run, grace: 1 };
      run = buyRelic(run, 'secondSoul');
      expect(run.maxGrace).toBe(4);
      expect(run.grace).toBe(2);
      void grace;
    }
  });

  it('refuses purchases it should refuse', () => {
    const broke = atShop(0);
    expect(() => buyRelic(broke, broke.shopOffers[0])).toThrow('Not enough souls');
    expect(() => buyHeal(broke)).toThrow('Not enough souls');
    const rich = atShop(50);
    expect(() => buyHeal(rich)).toThrow('already full');
    const hurt = { ...atShop(50), grace: 1 };
    expect(buyHeal(hurt).grace).toBe(2);
  });
});

describe("ferryman's coin", () => {
  const track = buildTrack(5);

  it('skips a stop but never the bottom', () => {
    let run: RunState = { ...newRun(5), relics: ['ferrymansCoin'] };
    run = useFerrymansCoin(run, track);
    expect(run.stopIndex).toBe(1);
    expect(run.relics).not.toContain('ferrymansCoin');
    expect(() => useFerrymansCoin(run, track)).toThrow('No coin');

    const atBottom: RunState = { ...newRun(5), stopIndex: BOTTOM_INDEX, relics: ['ferrymansCoin'] };
    expect(() => useFerrymansCoin(atBottom, track)).toThrow('Adversary');
  });
});

describe('full runs (headless)', () => {
  /** Play one hand at a stop exactly the way the client driver does. */
  function playStop(stop: StopDef, seed: number): { bid: number; taken: number } {
    const rng = mulberry32(seed);
    const seatCount = stop.demonCount + 1;
    const players: PlayerInfo[] = Array.from({ length: seatCount }, (_, i) => ({
      name: i === 0 ? 'You' : `Demon ${i}`,
      isBot: i > 0,
      connected: true
    }));
    const state = newGame({ seatCount, maxHandSize: stop.handSize, hookRule: false }, players);
    state.handIndex = stop.handSize - 2; // startNextHand advances to the k-card hand
    startNextHand(state, rng);
    while (state.phase === 'bidding') {
      placeBid(state, state.turn, chooseBid(state, state.turn));
    }
    while (state.phase === 'playing' || state.trickWinner !== null) {
      if (state.trickWinner !== null) {
        collectTrick(state);
      } else {
        playCard(state, state.turn, chooseCard(state, state.turn).id);
      }
    }
    const result = state.history[0];
    return { bid: result.bids[0], taken: result.taken[0] };
  }

  it.each([1, 2, 3, 4, 5])('run with seed %i ends in death or paradise', (seed) => {
    const track = buildTrack(seed);
    let run = newRun(seed);
    let guard = 0;
    while (run.phase === 'map' && guard++ < 300) {
      const outcome = playStop(track[run.stopIndex], seed * 1000 + run.attempts);
      run = resolveHand(run, track, outcome);
      if (run.phase === 'shop') {
        // buy greedily, then move on
        for (const offer of run.shopOffers.slice()) {
          const cost = run.souls;
          try {
            run = buyRelic(run, offer);
          } catch {
            void cost;
          }
        }
        run = leaveShop(run);
      }
    }
    expect(['dead', 'won']).toContain(run.phase);
    expect(run.grace).toBeGreaterThanOrEqual(0);
    expect(run.souls).toBeGreaterThanOrEqual(0);
    expect(run.log.length).toBeGreaterThan(1);
  });
});
