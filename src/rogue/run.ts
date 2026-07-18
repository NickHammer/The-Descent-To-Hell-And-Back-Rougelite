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

// Battle tuning. A gate is a fight: hands repeat until one side falls.
export const PLAYER_MAX_HP = 12;
export const HAND_DMG_BASE = 5; // made bid deals base+bid, missed bid takes base+bid
export const BOSS_HP = 40;
export const BOSS_BOUNTY = 8; // souls for felling the Adversary
export const EMBER_BRAND_BONUS = 3;
export const ASHEN_SHIELD_BLOCK = 2;

/** Demon HP at a stop: deeper tables (bigger hands) take more killing. */
export function demonMaxHpFor(stop: StopDef): number {
  return stop.region === 'bottom' ? BOSS_HP : 8 + 2 * stop.handSize;
}

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
  hp: number; // battle health; refilled each battle and on respawn
  maxHp: number;
  demonHp: number; // the current gate's demon health
  souls: number;
  relics: RelicId[];
  attempts: number; // hands played this run (also salts per-hand deals)
  phase: RunPhase;
  shopOffers: RelicId[];
  log: string[];
  /** How the most recent hand landed, for table feedback. */
  lastHand: {
    made: boolean;
    dmgDealt: number;
    dmgTaken: number;
    respawned: boolean;
    won: boolean;
  } | null;
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
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    demonHp: demonMaxHpFor(buildTrack(seed)[0]),
    souls: 0,
    relics: [],
    attempts: 0,
    phase: 'gift',
    shopOffers: giftOffers(seed),
    log: ['You wake at the gate. Something has left you a gift.'],
    lastHand: null
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

/** Souls earned for making a bid: bold bids pay more. */
export function soulsForClear(bid: number): number {
  return 3 + bid;
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
 * Apply the outcome of a played hand at the current stop's battle.
 * Made bid → damage the demon (bid + base, Ember Brand adds); fell it to advance.
 * Missed → take damage (bid + base; Usurer doubles, Ashen Shield blocks, Cracked
 * Halo voids a miss-by-one both ways). At 0 HP, grace catches you: -1 grace,
 * full HP, and the demon keeps its wounds. At 0 grace the pit keeps you.
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
    const dmg =
      HAND_DMG_BASE + outcome.bid + (run.relics.includes('emberBrand') ? EMBER_BRAND_BONUS : 0);
    const earned = soulsForClear(outcome.bid);
    next.demonHp -= dmg;
    next.souls += earned;
    if (next.demonHp <= 0) {
      next.demonHp = 0;
      if (stop.region === 'bottom') next.souls += BOSS_BOUNTY;
      next.lastHand = { made, dmgDealt: dmg, dmgTaken: 0, respawned: false, won: true };
      next.log.push(
        `${stop.label} falls: bid ${outcome.bid} made, ${dmg} damage. +${earned}${
          stop.region === 'bottom' ? ` souls and a ${BOSS_BOUNTY}-soul bounty` : ' souls'
        }.`
      );
      return advance(next, track, stop);
    }
    next.lastHand = { made, dmgDealt: dmg, dmgTaken: 0, respawned: false, won: false };
    next.log.push(
      `Bid ${outcome.bid} made at ${stop.label}: ${dmg} damage, ${next.demonHp} HP left. +${earned} souls.`
    );
    return next;
  }

  const haloSaves =
    run.relics.includes('crackedHalo') && Math.abs(outcome.bid - outcome.taken) === 1;
  if (haloSaves) {
    next.lastHand = { made, dmgDealt: 0, dmgTaken: 0, respawned: false, won: false };
    next.log.push(`Missed by one at ${stop.label} — the Cracked Halo holds. No blood drawn.`);
    return next;
  }

  let dmg = HAND_DMG_BASE + outcome.bid;
  if (stop.demonId === 'usurer') dmg *= 2;
  if (run.relics.includes('ashenShield')) dmg = Math.max(1, dmg - ASHEN_SHIELD_BLOCK);
  next.hp -= dmg;
  if (next.hp > 0) {
    next.lastHand = { made, dmgDealt: 0, dmgTaken: dmg, respawned: false, won: false };
    next.log.push(
      `Missed at ${stop.label}: bid ${outcome.bid}, took ${outcome.taken}. ${dmg} damage, ${next.hp} HP left.`
    );
    return next;
  }

  next.hp = 0;
  next.grace -= 1;
  if (next.grace <= 0) {
    next.grace = 0;
    next.phase = 'dead';
    next.lastHand = { made, dmgDealt: 0, dmgTaken: dmg, respawned: false, won: false };
    next.log.push(`You fall at ${stop.label}. Your last grace gutters out. The pit keeps you.`);
    return next;
  }
  next.hp = next.maxHp;
  next.lastHand = { made, dmgDealt: 0, dmgTaken: dmg, respawned: true, won: false };
  next.log.push(
    `You fall at ${stop.label} — grace catches you. -1 grace (${next.grace} left), and the fight goes on.`
  );
  return next;
}

/** Move past `stop`: open a shop, finish the run, or step to the next battle. */
function advance(run: RunState, track: StopDef[], stop: StopDef): RunState {
  if (stop.index === STOP_COUNT - 1) {
    run.phase = 'won';
    run.log.push('The last gate opens. Paradise. You made it back.');
    return run;
  }
  run.stopIndex = stop.index + 1;
  run.hp = run.maxHp;
  run.demonHp = demonMaxHpFor(track[run.stopIndex]);
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
