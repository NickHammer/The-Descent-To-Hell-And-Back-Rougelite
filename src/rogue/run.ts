/**
 * Run state for the roguelite: 19 stops down through hell and back up through
 * heaven, one hand of Oh Hell per stop. Pure logic — no DOM, no timers — so it
 * is unit-testable and the whole run can live client-side.
 */
import { DemonId, demonPool } from './demons.js';
import { ALL_RELIC_IDS, RELICS, RelicId } from './relics.js';
import { mulberry32, pick } from './rng.js';

export const STOP_COUNT = 19;
export const BOTTOM_INDEX = 9; // the 10-card boss stop
export const HEAL_COST = 6;

export type Region = 'hell' | 'bottom' | 'heaven';

export interface StopDef {
  index: number; // 0..18
  label: string; // "Circle 3", "The Bottom", "Sphere 2"
  region: Region;
  handSize: number; // 1..10..1
  demonCount: number; // opponents at the table
  demonId: DemonId;
  shopAfter: boolean; // a shop opens after clearing this stop
}

export type RunPhase = 'gift' | 'map' | 'shop' | 'dead' | 'won';

export interface RunState {
  seed: number;
  stopIndex: number; // current stop, 0..18
  grace: number;
  maxGrace: number;
  souls: number;
  relics: RelicId[];
  attempts: number; // hands played this run (also salts per-hand deals)
  phase: RunPhase;
  shopOffers: RelicId[];
  log: string[];
}

/** The 19-stop track, deterministic from the run seed. */
export function buildTrack(seed: number): StopDef[] {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const stops: StopDef[] = [];
  for (let i = 0; i < STOP_COUNT; i++) {
    const region: Region = i < BOTTOM_INDEX ? 'hell' : i === BOTTOM_INDEX ? 'bottom' : 'heaven';
    const handSize = i <= BOTTOM_INDEX ? i + 1 : STOP_COUNT - i;
    const label =
      region === 'hell' ? `Circle ${i + 1}` : region === 'bottom' ? 'The Bottom' : `Sphere ${i - BOTTOM_INDEX}`;
    stops.push({
      index: i,
      label,
      region,
      handSize,
      demonCount: i < 6 ? 2 : 3,
      demonId: region === 'bottom' ? 'adversary' : pick(rng, demonPool(i)),
      shopAfter: i % 3 === 2 && i !== STOP_COUNT - 1
    });
  }
  return stops;
}

export function newRun(seed = Math.floor(Math.random() * 2 ** 31)): RunState {
  return {
    seed,
    stopIndex: 0,
    grace: 3,
    maxGrace: 3,
    souls: 0,
    relics: [],
    attempts: 0,
    phase: 'gift',
    shopOffers: giftOffers(seed),
    log: ['You wake at the gate. Something has left you a gift.']
  };
}

const INFO_RELICS: RelicId[] = ['loadedDie', 'graveLedger'];

/**
 * Every run opens with a choice of one of three relics — an information relic
 * is always among them, so the blind stretch (circles 4-6, crossed on carried
 * grace with no shop in between) always has counterplay on offer.
 */
export function giftOffers(seed: number): RelicId[] {
  const rng = mulberry32(seed ^ 0x51f7);
  const offers = [pick(rng, INFO_RELICS)];
  while (offers.length < 3) {
    const candidate = pick(rng, ALL_RELIC_IDS);
    if (!offers.includes(candidate)) offers.push(candidate);
  }
  return offers;
}

export function takeGift(run: RunState, id: RelicId): RunState {
  if (run.phase !== 'gift') throw new Error('No gift to take');
  if (!run.shopOffers.includes(id)) throw new Error('Not offered');
  const next: RunState = {
    ...run,
    phase: 'map',
    shopOffers: [],
    relics: [...run.relics, id],
    log: [...run.log, `You take the ${RELICS[id].name}. The gate opens.`]
  };
  applyRelicEffects(next, id);
  return next;
}

/** Immediate (non-passive) effects a relic applies when gained. */
function applyRelicEffects(run: RunState, id: RelicId): void {
  if (id === 'secondSoul') {
    run.maxGrace += 1;
    run.grace = Math.min(run.maxGrace, run.grace + 1);
  }
}

/** Souls earned for making a bid: bold bids pay more; the boss pays a bounty. */
export function soulsForClear(bid: number, isBoss: boolean): number {
  return 3 + bid + (isBoss ? 8 : 0);
}

/**
 * The light fails as you descend: on hands of 4+ cards the trump stays
 * face-down while you bid (the demons can see it). Small hands play fair —
 * a blind 1-card bid is a coin flip, and coin-flip deaths feel unearned.
 */
export function isTrumpBlind(handSize: number): boolean {
  return handSize >= 4;
}

/**
 * Apply the outcome of a played hand at the current stop.
 * Made bid → advance (into shop/won as appropriate). Missed → lose grace
 * (Usurer ×2; Cracked Halo forgives a miss-by-one) and retry the same stop.
 */
export function resolveHand(
  run: RunState,
  track: StopDef[],
  outcome: { bid: number; taken: number }
): RunState {
  if (run.phase !== 'map') throw new Error(`Cannot resolve a hand during ${run.phase}`);
  const stop = track[run.stopIndex];
  const next: RunState = { ...run, attempts: run.attempts + 1, log: run.log.slice() };
  const made = outcome.bid === outcome.taken;

  if (made) {
    const earned = soulsForClear(outcome.bid, stop.region === 'bottom');
    next.souls += earned;
    next.log.push(`${stop.label} cleared: bid ${outcome.bid}, took ${outcome.taken}. +${earned} souls.`);
    return advance(next, track, stop);
  }

  const haloSaves =
    run.relics.includes('crackedHalo') && Math.abs(outcome.bid - outcome.taken) === 1;
  if (haloSaves) {
    next.log.push(`Missed by one at ${stop.label} — the Cracked Halo holds. No grace lost.`);
    return next;
  }

  const cost = stop.demonId === 'usurer' ? 2 : 1;
  next.grace -= cost;
  next.log.push(
    `Missed at ${stop.label}: bid ${outcome.bid}, took ${outcome.taken}. -${cost} grace.`
  );
  if (next.grace <= 0) {
    next.grace = 0;
    next.phase = 'dead';
    next.log.push('Your last grace gutters out. The pit keeps you.');
  }
  return next;
}

/** Move past `stop`: open a shop, finish the run, or step to the next stop. */
function advance(run: RunState, track: StopDef[], stop: StopDef): RunState {
  if (stop.index === STOP_COUNT - 1) {
    run.phase = 'won';
    run.log.push('The last gate opens. Paradise. You made it back.');
    return run;
  }
  run.stopIndex = stop.index + 1;
  if (stop.shopAfter) {
    run.phase = 'shop';
    run.shopOffers = shopStock(run);
    run.log.push('A lantern in the dark: a shop.');
  }
  return run;
}

/** Three unowned relics, seeded per visit. */
function shopStock(run: RunState): RelicId[] {
  const rng = mulberry32(run.seed ^ (run.stopIndex * 7919));
  const available = ALL_RELIC_IDS.filter(
    (id) => !run.relics.includes(id) || RELICS[id].consumable
  );
  const stock: RelicId[] = [];
  while (stock.length < 3 && stock.length < available.length) {
    const candidate = pick(rng, available);
    if (!stock.includes(candidate)) stock.push(candidate);
  }
  return stock;
}

export function buyRelic(run: RunState, id: RelicId): RunState {
  const relic = RELICS[id];
  if (run.phase !== 'shop') throw new Error('No shop here');
  if (!run.shopOffers.includes(id)) throw new Error('Not in stock');
  if (run.souls < relic.cost) throw new Error('Not enough souls');
  const next: RunState = {
    ...run,
    souls: run.souls - relic.cost,
    relics: [...run.relics, id],
    shopOffers: run.shopOffers.filter((o) => o !== id),
    log: [...run.log, `Bought ${relic.name} for ${relic.cost} souls.`]
  };
  applyRelicEffects(next, id);
  return next;
}

export function buyHeal(run: RunState): RunState {
  if (run.phase !== 'shop') throw new Error('No shop here');
  if (run.souls < HEAL_COST) throw new Error('Not enough souls');
  if (run.grace >= run.maxGrace) throw new Error('Grace is already full');
  return {
    ...run,
    souls: run.souls - HEAL_COST,
    grace: run.grace + 1,
    log: [...run.log, `Restored 1 grace for ${HEAL_COST} souls.`]
  };
}

export function leaveShop(run: RunState): RunState {
  if (run.phase !== 'shop') throw new Error('No shop here');
  return { ...run, phase: 'map', shopOffers: [] };
}

/** Ferryman's Coin: skip the current stop. Not past the Adversary. */
export function useFerrymansCoin(run: RunState, track: StopDef[]): RunState {
  if (run.phase !== 'map') throw new Error('Can only use the coin on the map');
  if (!run.relics.includes('ferrymansCoin')) throw new Error('No coin to spend');
  const stop = track[run.stopIndex];
  if (stop.region === 'bottom') throw new Error('The ferryman will not row past the Adversary');
  const idx = run.relics.indexOf('ferrymansCoin');
  const next: RunState = {
    ...run,
    relics: run.relics.filter((_, i) => i !== idx),
    log: [...run.log, `The ferryman rows you past ${stop.label}.`]
  };
  return advance(next, track, stop);
}
