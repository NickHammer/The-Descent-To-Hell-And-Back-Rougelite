import { describe, expect, it } from 'vitest';
import { chooseBid, chooseCard } from '../shared/ai.js';
import { collectTrick, newGame, placeBid, playCard, startNextHand } from '../shared/engine.js';
import { PlayerInfo } from '../shared/types.js';
import { DECKS } from './decks.js';
import { CRACKED_HALO_CHARGES_PER_GATE, RELIQUARY_HP_PER_FELL } from './relics.js';
import { mulberry32 } from './rng.js';
import {
  ASHEN_SHIELD_BLOCK,
  BOSS_BOUNTY,
  BOSS_HP,
  CLEANSE_COST,
  cleanseCard,
  FELL_HEAL,
  BOTTOM_INDEX,
  buildTrack,
  buyHeal,
  buyRelic,
  demonMaxHpsFor,
  destroyCard,
  duplicateCard,
  enchantCard,
  giftOffers,
  isTrumpBlind,
  devClearGate,
  leadAlive,
  leaveShop,
  MIN_DECK_SIZE,
  MAX_DECK_SIZE,
  newRun,
  PLAYER_MAX_HP,
  resolveHand,
  RunState,
  soulsForClear,
  STOP_COUNT,
  StopDef,
  takeGift,
  useFerrymansCoin,
  usePactEcho,
  usePactRuin,
  usePactSeal
} from './run.js';
import { scoreDemonStrike, scoreStrike, TrickWin } from './scoring.js';

/** Builds `n` fake demon-won tricks for demon-strike expectations, all plain 2s. */
const demonTricks = (n: number): TrickWin[] =>
  Array.from({ length: n }, () => ({ rank: 2, suit: 'C' as const, trump: false }));

/** A run that has already taken its gate gift and stands on the map. */
function startedRun(seed: number): RunState {
  return { ...newRun(seed), phase: 'map', shopOffers: [] };
}

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

  it('keeps small hands fair: blind bidding starts at 4 cards', () => {
    expect(isTrumpBlind(1)).toBe(false);
    expect(isTrumpBlind(3)).toBe(false);
    expect(isTrumpBlind(4)).toBe(true);
    expect(isTrumpBlind(10)).toBe(true);
  });

  it('is deterministic for a seed', () => {
    expect(buildTrack(42)).toEqual(buildTrack(42));
    expect(buildTrack(42).map((s) => s.demonId)).not.toEqual(buildTrack(43).map((s) => s.demonId));
  });
});

describe('demon HP split', () => {
  it('preserves table totals, lead-heavy, and the wall climbs with the stop index', () => {
    const track = buildTrack(3);
    for (const stop of track) {
      const hps = demonMaxHpsFor(stop);
      expect(hps.length).toBe(stop.demonCount);
      expect(hps[0]).toBe(Math.ceil(hps.reduce((a, b) => a + b, 0) / 2));
      for (const hp of hps) expect(hp).toBeGreaterThan(0);
    }
    const total = (i: number) => demonMaxHpsFor(track[i]).reduce((a, b) => a + b, 0);
    // Hell's wall climbs with depth; heaven's raw totals taper because the
    // shrinking hands score fewer chips (hands-to-clear still climbs — the
    // pacing probe holds that curve); the boss is the tallest wall of all.
    for (let i = 1; i < BOTTOM_INDEX; i++) expect(total(i)).toBeGreaterThan(total(i - 1));
    for (let i = BOTTOM_INDEX + 2; i < STOP_COUNT; i++) expect(total(i)).toBeLessThan(total(i - 1));
    expect(total(BOTTOM_INDEX)).toBe(BOSS_HP);
    for (let i = 0; i < STOP_COUNT; i++) {
      if (i !== BOTTOM_INDEX) expect(total(i)).toBeLessThan(BOSS_HP);
    }
  });

  it('scales the wall up with damage-relevant relics, leaving the relic-less curve untouched', () => {
    const track = buildTrack(3);
    const stop = track[BOTTOM_INDEX + 5]; // deep heaven, where the taper is steepest
    const bare = demonMaxHpsFor(stop).reduce((a, b) => a + b, 0);
    const built = demonMaxHpsFor(stop, ['emberBrand', 'pyre', 'zerosCrown']).reduce((a, b) => a + b, 0);
    const stacked = demonMaxHpsFor(stop, [
      'emberBrand',
      'pyre',
      'zerosCrown',
      'heraldSpades',
      'ledgerOfWrath'
    ]).reduce((a, b) => a + b, 0);
    expect(built).toBeGreaterThan(bare);
    expect(stacked).toBeGreaterThan(built);
    // Relics that don't feed chips/mult (info, defense, consumables) don't inflate the wall.
    expect(demonMaxHpsFor(stop, ['loadedDie', 'ashenShield']).reduce((a, b) => a + b, 0)).toBe(bare);
  });
});

describe('battle resolution', () => {
  const track = buildTrack(7);

  it('made bid strikes only the chosen demon, pays souls, and a kill feeds you', () => {
    const run: RunState = { ...startedRun(7), hp: 5 }; // circle 1: [8, 8]
    const wins: TrickWin[] = [{ rank: 14, suit: 'S', trump: false }];
    const score = scoreStrike(1, wins, []); // (10 + 14) × 1.5 = 36
    const next = resolveHand(run, track, { bid: 1, taken: 1, target: 1, wins });
    expect(next.demonHps[1]).toBe(0); // 36 damage overwhelms 8, no spill
    expect(next.demonHps[0]).toBe(run.demonHps[0]);
    expect(next.souls).toBe(soulsForClear(score.total));
    expect(next.hp).toBe(5 + FELL_HEAL);
    expect(next.phase).toBe('map');
    expect(next.stopIndex).toBe(0); // lead still stands
    expect(next.lastHand).toMatchObject({ made: true, won: false, felled: true, dmgDealt: 36 });
    expect(next.lastHand?.score).toEqual(score);
  });

  it('trick quality is the chip axis: bigger winning cards, bigger strike', () => {
    const run: RunState = { ...startedRun(7), demonHps: [200, 8] };
    const small = resolveHand(run, track, {
      bid: 1,
      taken: 1,
      target: 0,
      wins: [{ rank: 2, suit: 'C', trump: false }]
    });
    const large = resolveHand(run, track, {
      bid: 1,
      taken: 1,
      target: 0,
      wins: [{ rank: 14, suit: 'S', trump: true }]
    });
    expect(small.lastHand?.dmgDealt).toBe(18); // (10 + 2) × 1.5
    expect(large.lastHand?.dmgDealt).toBe(36); // (10 + 14) × 1.5
  });

  it('requires a living target for a made bid', () => {
    const run = startedRun(7);
    expect(() => resolveHand(run, track, { bid: 0, taken: 0 })).toThrow('living demon');
    const halfDead: RunState = { ...run, demonHps: [5, 0] };
    expect(() => resolveHand(halfDead, track, { bid: 0, taken: 0, target: 1 })).toThrow(
      'living demon'
    );
  });

  it('clearing the last demon advances and refills both sides', () => {
    const run: RunState = { ...startedRun(7), demonHps: [3, 0] };
    const next = resolveHand(run, track, { bid: 0, taken: 0, target: 0 });
    expect(next.stopIndex).toBe(1);
    expect(next.demonHps).toEqual(demonMaxHpsFor(track[1]));
    expect(next.hp).toBe(next.maxHp);
    expect(next.lastHand).toMatchObject({ won: true });
  });

  it('missed bid damage is scored from demon trick wins and miss margin, not a flat formula', () => {
    const run = startedRun(7);
    const near = resolveHand(run, track, { bid: 1, taken: 0, demonWins: demonTricks(1) });
    expect(near.stopIndex).toBe(0);
    expect(near.hp).toBe(PLAYER_MAX_HP - scoreDemonStrike(demonTricks(1), 1).total);
    expect(near.grace).toBe(3);
    expect(near.phase).toBe('map');

    // a wilder miss (bigger margin) hits harder even with the same tricks won
    const wild = resolveHand(run, track, { bid: 5, taken: 0, demonWins: demonTricks(1) });
    expect(PLAYER_MAX_HP - wild.hp).toBeGreaterThan(PLAYER_MAX_HP - near.hp);

    // more tricks won by the table hits harder even with the same miss margin
    const swept = resolveHand(run, track, { bid: 1, taken: 0, demonWins: demonTricks(4) });
    expect(PLAYER_MAX_HP - swept.hp).toBeGreaterThan(PLAYER_MAX_HP - near.hp);
  });

  it('falling to 0 HP costs a grace, respawns at full HP, and the demons keep their wounds', () => {
    const run: RunState = { ...startedRun(7), hp: 2, demonHps: [4, 2] };
    const next = resolveHand(run, track, { bid: 1, taken: 3 });
    expect(next.grace).toBe(2);
    expect(next.hp).toBe(next.maxHp);
    expect(next.demonHps).toEqual([4, 2]);
    expect(next.phase).toBe('map');
    expect(next.lastHand).toMatchObject({ respawned: true });
  });

  it('dies when the last grace is spent', () => {
    let run: RunState = { ...startedRun(7), grace: 1, hp: 1 };
    run = resolveHand(run, track, { bid: 0, taken: 1 });
    expect(run.phase).toBe('dead');
    expect(run.grace).toBe(0);
    expect(run.hp).toBe(0);
  });

  it('the usurer doubles damage taken only while it lives', () => {
    const usurerTrack: StopDef[] = track.map((s, i) =>
      i === 6 ? { ...s, demonId: 'usurer' as const } : s
    );
    const wins = demonTricks(2);
    const run: RunState = { ...startedRun(7), stopIndex: 6, demonHps: [8, 4, 4], hp: PLAYER_MAX_HP };
    expect(leadAlive(run)).toBe(true);
    const next = resolveHand(run, usurerTrack, { bid: 2, taken: 4, demonWins: wins });
    expect(next.lastHand?.dmgTaken).toBe(2 * scoreDemonStrike(wins, 2).total);

    const leadDead: RunState = {
      ...startedRun(7),
      stopIndex: 6,
      demonHps: [0, 5, 5],
      hp: PLAYER_MAX_HP
    };
    const fair = resolveHand(leadDead, usurerTrack, { bid: 2, taken: 4, demonWins: wins });
    expect(fair.lastHand?.dmgTaken).toBe(scoreDemonStrike(wins, 2).total);
  });

  it('cracked halo voids a miss-by-one, once per gate — the charge doesn\'t refill mid-gate', () => {
    const run: RunState = { ...startedRun(7), relics: ['crackedHalo'] };
    expect(run.crackedHaloCharges).toBe(CRACKED_HALO_CHARGES_PER_GATE);
    const saved = resolveHand(run, track, { bid: 1, taken: 0, demonWins: demonTricks(1) });
    expect(saved.hp).toBe(PLAYER_MAX_HP);
    expect(saved.demonHps).toEqual(run.demonHps);
    expect(saved.souls).toBe(0);
    expect(saved.crackedHaloCharges).toBe(CRACKED_HALO_CHARGES_PER_GATE - 1);

    // the charge is spent: a second miss-by-one this gate draws blood
    const spent = resolveHand(saved, track, { bid: 1, taken: 0, demonWins: demonTricks(1) });
    expect(spent.hp).toBeLessThan(PLAYER_MAX_HP);

    // a miss by two never needed the halo, and still hurts
    const worse = resolveHand(run, track, { bid: 1, taken: 3, demonWins: demonTricks(2) });
    expect(worse.hp).toBeLessThan(PLAYER_MAX_HP);
  });

  it('cracked halo charge refills at a new gate', () => {
    const run: RunState = {
      ...startedRun(7),
      relics: ['crackedHalo'],
      crackedHaloCharges: 0,
      demonHps: [3, 0]
    };
    const cleared = resolveHand(run, track, { bid: 0, taken: 0, target: 0 });
    expect(cleared.stopIndex).toBe(1);
    expect(cleared.crackedHaloCharges).toBe(CRACKED_HALO_CHARGES_PER_GATE);
  });

  it('ember brand adds mult to the strike; ashen shield blocks damage taken', () => {
    const armed: RunState = { ...startedRun(7), relics: ['emberBrand'], demonHps: [30, 5] };
    const struck = resolveHand(armed, track, { bid: 1, taken: 1, target: 0 });
    expect(struck.demonHps[0]).toBe(30 - scoreStrike(1, [], ['emberBrand']).total); // 10 × 2.5

    const shielded: RunState = { ...startedRun(7), relics: ['ashenShield'] };
    const wins = demonTricks(1);
    const hit = resolveHand(shielded, track, { bid: 1, taken: 0, demonWins: wins });
    const raw = scoreDemonStrike(wins, 1).total;
    expect(hit.hp).toBe(PLAYER_MAX_HP - Math.max(1, raw - ASHEN_SHIELD_BLOCK));
  });

  it('pays the boss bounty when the bottom is cleared', () => {
    const run: RunState = { ...startedRun(7), stopIndex: BOTTOM_INDEX, demonHps: [2, 0, 0] };
    const next = resolveHand(run, track, { bid: 3, taken: 3, target: 0 });
    expect(next.souls).toBe(soulsForClear(scoreStrike(3, [], []).total) + BOSS_BOUNTY);
    expect(next.stopIndex).toBe(BOTTOM_INDEX + 1);
  });

  it('opens a shop after stop 2 and wins after the last stop', () => {
    let run: RunState = { ...startedRun(7), stopIndex: 2, demonHps: [1, 0] };
    run = resolveHand(run, track, { bid: 0, taken: 0, target: 0 });
    expect(run.phase).toBe('shop');
    expect(run.shopOffers.length).toBeGreaterThan(0);
    run = leaveShop(run);
    expect(run.phase).toBe('map');
    expect(run.stopIndex).toBe(3);

    let last: RunState = { ...startedRun(7), stopIndex: STOP_COUNT - 1, demonHps: [1, 0, 0] };
    last = resolveHand(last, track, { bid: 1, taken: 1, target: 0 });
    expect(last.phase).toBe('won');
  });
});

describe('shop', () => {
  const track = buildTrack(11);

  function atShop(souls: number): RunState {
    let run: RunState = { ...startedRun(11), stopIndex: 2, souls, demonHps: [1, 0] };
    run = resolveHand(run, track, { bid: 0, taken: 0, target: 0 });
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

describe('the gift at the gate', () => {
  it('every run opens with a choice of three, always including an information relic', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const run = newRun(seed);
      expect(run.phase).toBe('gift');
      expect(run.shopOffers.length).toBe(3);
      expect(new Set(run.shopOffers).size).toBe(3);
      expect(run.shopOffers.some((id) => id === 'loadedDie' || id === 'graveLedger')).toBe(true);
      expect(run.shopOffers).toEqual(giftOffers(seed));
    }
  });

  it('taking the gift is free, applies effects, and opens the map', () => {
    const run = newRun(99);
    const taken = takeGift(run, run.shopOffers[0]);
    expect(taken.phase).toBe('map');
    expect(taken.relics).toEqual([run.shopOffers[0]]);
    expect(taken.souls).toBe(0);
    expect(taken.shopOffers).toEqual([]);
    expect(() => takeGift(taken, 'loadedDie')).toThrow('No gift');

    const withSoul: RunState = { ...newRun(99), shopOffers: ['secondSoul', 'loadedDie', 'crackedHalo'], grace: 2 };
    const soulTaken = takeGift(withSoul, 'secondSoul');
    expect(soulTaken.maxGrace).toBe(4);
    expect(soulTaken.grace).toBe(3);

    const fixed: RunState = { ...newRun(99), shopOffers: ['loadedDie', 'secondSoul', 'crackedHalo'] };
    expect(() => takeGift(fixed, 'ferrymansCoin')).toThrow('Not offered');
  });

  it('cannot play a hand before taking the gift', () => {
    const run = newRun(3);
    expect(() => resolveHand(run, buildTrack(3), { bid: 0, taken: 0 })).toThrow();
  });

  it('an instant relic (Embered Pact) applies at once and never sits in the tray', () => {
    const withPact: RunState = { ...newRun(99), shopOffers: ['emberedPact', 'loadedDie', 'secondSoul'] };
    const taken = takeGift(withPact, 'emberedPact');
    expect(taken.relics).toEqual([]); // consumed immediately, not held
    const enchanted = taken.deck.filter((c) => c.enchant === 'gilded');
    expect(enchanted.length).toBe(1);
  });
});

describe('engine relics and demon strike', () => {
  const track = buildTrack(7);

  it('reliquary grants permanent max HP whenever a demon falls', () => {
    const run: RunState = { ...startedRun(7), relics: ['reliquary'], demonHps: [3, 0] };
    const next = resolveHand(run, track, { bid: 0, taken: 0, target: 0 });
    expect(next.maxHp).toBe(run.maxHp + RELIQUARY_HP_PER_FELL);
  });

  it("ledger of wrath's chip bonus rides the streak resolveHand tracks", () => {
    const run: RunState = { ...startedRun(7), relics: ['ledgerOfWrath'], demonHps: [1000] };
    expect(run.madeStreak).toBe(0);
    const wins: TrickWin[] = [{ rank: 5, suit: 'S', trump: false }];

    const first = resolveHand(run, track, { bid: 1, taken: 1, target: 0, wins });
    expect(first.madeStreak).toBe(1);
    expect(first.lastHand?.dmgDealt).toBe(scoreStrike(1, wins, ['ledgerOfWrath'], 1).total);

    const second = resolveHand(first, track, { bid: 1, taken: 1, target: 0, wins });
    expect(second.madeStreak).toBe(2);
    // the streak compounds: the second made bid hits harder than the first
    expect(second.lastHand!.dmgDealt).toBeGreaterThan(first.lastHand!.dmgDealt);

    const missed = resolveHand(second, track, { bid: 1, taken: 0, demonWins: demonTricks(1) });
    expect(missed.madeStreak).toBe(0);
  });

  it('the last gate is a fixed finale: the Warden, not a pool roll', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(buildTrack(seed)[STOP_COUNT - 1].demonId).toBe('warden');
    }
  });

  it('the persistent deck carries enchantments across hands', () => {
    const run = newRun(11);
    expect(run.deck.length).toBe(52);
    const enchanted = enchantCard(run, 'S4', 'gilded');
    expect(enchanted.deck.find((c) => c.id === 'S4')?.enchant).toBe('gilded');
    // the rest of the deck is untouched
    expect(enchanted.deck.filter((c) => c.enchant).length).toBe(1);
  });
});

describe('starting decks', () => {
  it('standard deck is the default: no relics, no HP/grace/soul changes', () => {
    const run = newRun(5);
    expect(run.deckId).toBe('standard');
    expect(run.relics).toEqual([]);
    expect(run.maxHp).toBe(PLAYER_MAX_HP);
    expect(run.maxGrace).toBe(3);
    expect(run.souls).toBe(0);
  });

  it("gambler's deck arrives in debt: souls up front, less grace to spend", () => {
    const run = newRun(5, 'gamblers');
    expect(run.deckId).toBe('gamblers');
    expect(run.souls).toBe(DECKS.gamblers.startSouls);
    expect(run.maxGrace).toBe(DECKS.gamblers.maxGrace);
    expect(run.grace).toBe(DECKS.gamblers.maxGrace);
  });

  it('ashen deck starts armed and brittle: Ember Brand + Ashen Shield, lower max HP', () => {
    const run = newRun(5, 'ashen');
    expect(run.deckId).toBe('ashen');
    expect(run.relics).toEqual(['emberBrand', 'ashenShield']);
    expect(run.maxHp).toBe(DECKS.ashen.maxHp);
    expect(run.hp).toBe(DECKS.ashen.maxHp);
  });
});

describe('demon corruption and shop cleanse', () => {
  const track = buildTrack(5);

  it('clearing a hell stop can curse a random unenchanted card', () => {
    // seed 5's track corrupts on at least one of the first few hell clears
    let run: RunState = { ...startedRun(5), demonHps: [1] };
    let corrupted = false;
    for (let i = 0; i < 6 && run.phase === 'map'; i++) {
      run = resolveHand(run, track, { bid: 0, taken: 0, target: 0 });
      if (run.phase === 'shop') run = leaveShop(run);
      run = { ...run, demonHps: run.demonHps.map(() => 1) };
      if (run.deck.some((c) => c.enchant === 'cursed')) corrupted = true;
    }
    expect(corrupted).toBe(true);
  });

  it('never corrupts an already-enchanted card', () => {
    const enchanted = enchantCard(startedRun(5), 'S4', 'gilded');
    const run: RunState = { ...enchanted, demonHps: [1] };
    const next = resolveHand(run, track, { bid: 0, taken: 0, target: 0 });
    expect(next.deck.find((c) => c.id === 'S4')?.enchant).toBe('gilded');
  });

  it('cleanse removes a curse for souls, shop-only, cursed-only', () => {
    const cursed = enchantCard(startedRun(5), 'S4', 'cursed');
    const atShop: RunState = { ...cursed, phase: 'shop', souls: 20 };
    const cleaned = cleanseCard(atShop, 'S4');
    expect(cleaned.deck.find((c) => c.id === 'S4')?.enchant).toBeUndefined();
    expect(cleaned.souls).toBe(20 - CLEANSE_COST);

    expect(() => cleanseCard(cursed, 'S4')).toThrow('No shop here'); // not in a shop
    const gilded = enchantCard(startedRun(5), 'S4', 'gilded');
    expect(() => cleanseCard({ ...gilded, phase: 'shop', souls: 20 }, 'S4')).toThrow('Nothing to cleanse');
    expect(() => cleanseCard({ ...cursed, phase: 'shop', souls: 0 }, 'S4')).toThrow('Not enough souls');
  });
});

describe('deck editing: destroy and duplicate', () => {
  it('destroy removes a card but refuses to shrink below what a full table needs', () => {
    const run = newRun(5);
    const next = destroyCard(run, 'S4');
    expect(next.deck.length).toBe(51);
    expect(next.deck.some((c) => c.id === 'S4')).toBe(false);

    const thin: RunState = { ...run, deck: run.deck.slice(0, MIN_DECK_SIZE) };
    expect(() => destroyCard(thin, thin.deck[0].id)).toThrow('too thin');
  });

  it('duplicate adds a distinct-id copy but refuses past the cap', () => {
    const run = newRun(5);
    const once = duplicateCard(run, 'H9');
    expect(once.deck.length).toBe(53);
    const copy = once.deck.find((c) => c.id === 'H9-dup1');
    expect(copy).toMatchObject({ rank: 9, suit: 'H' });

    const twice = duplicateCard(once, 'H9');
    expect(twice.deck.some((c) => c.id === 'H9-dup2')).toBe(true);

    const full: RunState = {
      ...run,
      deck: [...run.deck, ...Array.from({ length: MAX_DECK_SIZE - run.deck.length }, (_, i) => ({
        suit: 'S' as const,
        rank: 2,
        id: `filler-${i}`
      }))]
    };
    expect(full.deck.length).toBe(MAX_DECK_SIZE);
    expect(() => duplicateCard(full, 'H9')).toThrow('cannot hold');
  });
});

describe('shop pacts', () => {
  it('pact of sealing spends the relic and marks a chosen card with a chosen enchant', () => {
    const run: RunState = { ...startedRun(5), relics: ['pactSeal'] };
    const next = usePactSeal(run, 'D7', 'marked');
    expect(next.relics).not.toContain('pactSeal');
    expect(next.deck.find((c) => c.id === 'D7')?.enchant).toBe('marked');
    expect(() => usePactSeal(next, 'D7', 'marked')).toThrow('No Pact of Sealing');

    const alreadyEnchanted = enchantCard({ ...startedRun(5), relics: ['pactSeal'] }, 'D7', 'gilded');
    expect(() => usePactSeal(alreadyEnchanted, 'D7', 'royal')).toThrow('already enchanted');
  });

  it('pact of ruin spends the relic and burns the chosen card out of the deck', () => {
    const run: RunState = { ...startedRun(5), relics: ['pactRuin'] };
    const next = usePactRuin(run, 'C2');
    expect(next.relics).not.toContain('pactRuin');
    expect(next.deck.some((c) => c.id === 'C2')).toBe(false);
    expect(next.deck.length).toBe(51);
  });

  it('pact of echoes spends the relic and duplicates the chosen card', () => {
    const run: RunState = { ...startedRun(5), relics: ['pactEcho'] };
    const next = usePactEcho(run, 'C2');
    expect(next.relics).not.toContain('pactEcho');
    expect(next.deck.length).toBe(53);
    expect(next.deck.some((c) => c.id === 'C2-dup1')).toBe(true);
  });

  it('pacts are spent between fights, not mid-hand', () => {
    const inHand: RunState = { ...startedRun(5), relics: ['pactSeal'], phase: 'gift' };
    expect(() => usePactSeal(inHand, 'D7', 'marked')).toThrow('between fights');
  });
});

/** Mirrors `devSyntheticStrike` + the payout loop in `devClearGate`, for asserting exact souls. */
function expectedDevSouls(stop: StopDef, relics: RunState['relics'] = []): number {
  const bid = Math.max(1, Math.ceil(stop.handSize / 2));
  const wins: TrickWin[] = Array.from({ length: bid }, () => ({ rank: 10, suit: 'S' as const, trump: false }));
  const strike = scoreStrike(bid, wins, relics);
  return demonMaxHpsFor(stop).reduce((sum, hp) => {
    let remaining = hp;
    let souls = 0;
    while (remaining > 0) {
      remaining -= strike.total;
      souls += soulsForClear(strike.total);
    }
    return sum + souls;
  }, 0);
}

describe('dev auto-win', () => {
  const track = buildTrack(5);

  it('clears the gate through the normal advance flow, paying out souls on the real curve', () => {
    let run = startedRun(5);
    run = devClearGate(run, track);
    expect(run.stopIndex).toBe(1);
    expect(run.demonHps).toEqual(demonMaxHpsFor(track[1]));
    expect(run.souls).toBe(expectedDevSouls(track[0]));
    expect(run.souls).toBeGreaterThan(0);

    const atBottom: RunState = {
      ...startedRun(5),
      stopIndex: BOTTOM_INDEX,
      demonHps: demonMaxHpsFor(track[BOTTOM_INDEX])
    };
    const past = devClearGate(atBottom, track);
    expect(past.souls).toBe(expectedDevSouls(track[BOTTOM_INDEX]) + BOSS_BOUNTY);
    expect(past.stopIndex).toBe(BOTTOM_INDEX + 1);

    const dead: RunState = { ...startedRun(5), phase: 'dead' };
    expect(() => devClearGate(dead, track)).toThrow();
  });

  it('folds owned relics into the synthetic strike (e.g. Ember Brand mult)', () => {
    const withRelic: RunState = { ...startedRun(5), relics: ['emberBrand'] };
    const cleared = devClearGate(withRelic, track);
    expect(cleared.souls).toBe(expectedDevSouls(track[0], ['emberBrand']));
    expect(cleared.souls).not.toBe(expectedDevSouls(track[0]));
  });
});

describe("ferryman's coin", () => {
  const track = buildTrack(5);

  it('skips a stop but never the bottom', () => {
    let run: RunState = { ...startedRun(5), relics: ['ferrymansCoin'] };
    run = useFerrymansCoin(run, track);
    expect(run.stopIndex).toBe(1);
    expect(run.relics).not.toContain('ferrymansCoin');
    expect(() => useFerrymansCoin(run, track)).toThrow('No coin');

    const atBottom: RunState = { ...startedRun(5), stopIndex: BOTTOM_INDEX, relics: ['ferrymansCoin'] };
    expect(() => useFerrymansCoin(atBottom, track)).toThrow('Adversary');
  });
});

describe('full runs (headless)', () => {
  /** Play one hand at a stop exactly the way the client driver does. */
  function playStop(
    stop: StopDef,
    livingDemons: number,
    seed: number
  ): { bid: number; taken: number; wins: TrickWin[]; demonWins: TrickWin[] } {
    const rng = mulberry32(seed);
    const seatCount = livingDemons + 1;
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
    const winsFor = (seat: (s: number) => boolean): TrickWin[] =>
      state.trickLog
        .filter((t) => seat(t.winner))
        .map((t) => {
          const card = t.cards.find((tc) => tc.seat === t.winner)!.card;
          return { rank: card.rank, suit: card.suit, trump: card.suit === t.trumpSuit };
        });
    return {
      bid: result.bids[0],
      taken: result.taken[0],
      wins: winsFor((w) => w === 0),
      demonWins: winsFor((w) => w !== 0)
    };
  }

  it.each([1, 2, 3, 4, 5])('run with seed %i ends in death or paradise', (seed) => {
    const track = buildTrack(seed);
    let run = newRun(seed);
    run = takeGift(run, run.shopOffers[0]);
    let guard = 0;
    while (run.phase === 'map' && guard++ < 300) {
      const living = run.demonHps.filter((hp) => hp > 0).length;
      const outcome = playStop(track[run.stopIndex], living, seed * 1000 + run.attempts);
      // strike the weakest living demon, the way a pragmatic player would
      let target = -1;
      run.demonHps.forEach((hp, i) => {
        if (hp > 0 && (target === -1 || hp < run.demonHps[target])) target = i;
      });
      run = resolveHand(run, track, { ...outcome, target });
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
