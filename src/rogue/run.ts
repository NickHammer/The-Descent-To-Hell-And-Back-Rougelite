/**
 * Run state for the roguelite: 19 stops down through hell and back up through
 * heaven, one hand of Oh Hell per stop. Pure logic — no DOM, no timers — so it
 * is unit-testable and the whole run can live client-side.
 */
import { buildDeck } from '../shared/engine.js';
import { Card, rankLabel, SUIT_NAMES } from '../shared/types.js';
import { DeckId, DECKS } from './decks.js';
import { DemonId, demonPool, rosterFor } from './demons.js';
import {
  ALL_RELIC_IDS,
  CRACKED_HALO_CHARGES_PER_GATE,
  RELICS,
  RELIQUARY_HP_PER_FELL,
  RelicId,
  TIER_WEIGHT
} from './relics.js';
import { mulberry32, pick, pickWeighted } from './rng.js';
import {
  DemonStrikeScore,
  ENCHANTMENTS,
  EnchantId,
  scoreDemonStrike,
  scoreMadeBidTrickle,
  scoreStrike,
  StrikeScore,
  TrickWin
} from './scoring.js';

export const STOP_COUNT = 19;
export const BOTTOM_INDEX = 9; // the 10-card boss stop
export const HEAL_COST = 6;
/** A shop cleanse (remove a cursed enchant) costs this many souls. */
export const CLEANSE_COST = 8;
/** A hell stop clear has this chance to corrupt a random unenchanted card. */
export const CORRUPTION_CHANCE = 0.35;
/**
 * The deck can never shrink (Pact of Ruin) below what the biggest gate needs
 * to deal: 4 seats (player + 3 demons) × the 10-card Bottom hand, plus the
 * trump card.
 */
export const MIN_DECK_SIZE = 4 * 10 + 1;
/** The deck can never grow (Pact of Echoes) past this many cards. */
export const MAX_DECK_SIZE = 60;

// Battle tuning. A gate is a fight: hands repeat until one side falls.
// Made-bid damage is scored in scoring.ts: (base + trick chips) × bid mult.
// Missed-bid damage is scored too, mirrored: (base + demon tricks) × miss mult.
export const PLAYER_MAX_HP = 14;
export const BOSS_HP = 130;
export const BOSS_BOUNTY = 8; // souls for felling the Adversary
export const ASHEN_SHIELD_BLOCK = 2;
/** HP restored when a demon falls: a bite of its soul steadies you. */
export const FELL_HEAL = 2;
/**
 * Relics that meaningfully feed the chips/mult product — used only to scale
 * the wall to match a built machine (see `wallPowerFactor`). Card enchants
 * (Gilded, Herald-adjacent suit stacking, etc.) aren't counted here yet —
 * a known gap, not an oversight; see docs/SCORING.md.
 */
const DAMAGE_RELICS: RelicId[] = [
  'emberBrand',
  'pyre',
  'zerosCrown',
  'heraldHearts',
  'heraldDiamonds',
  'heraldClubs',
  'heraldSpades',
  'ledgerOfWrath'
];
/** +this much wall per damage-relevant relic owned. */
const WALL_POWER_PER_RELIC = 0.35;

/**
 * How much a built machine outscales the relic-less baseline the wall was
 * originally tuned against. 1 with no damage relics (the wall is untouched —
 * `pacing.test.ts`'s relic-less probe still holds exactly), climbing from
 * there. Most chip/mult sources are flat bonuses that don't shrink with hand
 * size the way relic-less damage naturally does (see `demonMaxHpsFor`), so
 * without this the stop where a run has accumulated the most power (the
 * finale) ends up with the *weakest* wall in the game — exactly backwards.
 */
function wallPowerFactor(relics: RelicId[]): number {
  const count = relics.filter((r) => DAMAGE_RELICS.includes(r)).length;
  return 1 + WALL_POWER_PER_RELIC * count;
}

/**
 * Per-demon HP at a stop, tuned so hands-to-clear climbs the whole run
 * (see pacing.test.ts, the headless probe that holds this curve). Hell's
 * wall rises with depth. Heaven's raw totals taper — shrinking hands score
 * fewer chips, so a smaller number is still a taller wall — while the
 * hands-to-clear keeps climbing toward the final gates. `relics` scales the
 * whole wall up to match a built machine — see `wallPowerFactor`.
 * The lead demon carries half the table total, minions split the rest.
 */
export function demonMaxHpsFor(stop: StopDef, relics: RelicId[] = []): number[] {
  const rawTotal =
    stop.region === 'bottom'
      ? BOSS_HP
      : stop.region === 'hell'
        ? 16 + 7 * stop.index
        : 195 - 9 * stop.index;
  const total = Math.round(rawTotal * wallPowerFactor(relics));
  const lead = Math.ceil(total / 2);
  const minionCount = stop.demonCount - 1;
  const rest = total - lead;
  const base = Math.floor(rest / minionCount);
  const spare = rest - base * minionCount;
  return [lead, ...Array.from({ length: minionCount }, (_, i) => base + (i < spare ? 1 : 0))];
}

/** The lead demon owns the table's quirk; it dies with them. */
export function leadAlive(run: RunState): boolean {
  return run.demonHps[0] > 0;
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

export type RunPhase = 'map' | 'shop' | 'dead' | 'won';

export interface RunState {
  seed: number;
  stopIndex: number; // current stop, 0..18
  grace: number;
  maxGrace: number;
  hp: number; // battle health; refilled each battle and on respawn
  maxHp: number;
  /** the current gate's demons, lead first; 0 = dead and gone from the table */
  demonHps: number[];
  souls: number;
  relics: RelicId[];
  attempts: number; // hands played this run (also salts per-hand deals)
  phase: RunPhase;
  shopOffers: RelicId[];
  /** Whether the current shop visit has already spent its one reroll (see `rerollShop`). */
  shopRerolled: boolean;
  log: string[];
  /**
   * The persistent 52-card deck, carried and reshuffled at every gate. Cards
   * can carry an `enchant` id (see scoring.ts) that survives the whole run —
   * whoever wins a trick with an enchanted card gets its effect, you or a demon.
   */
  deck: Card[];
  /** Cracked Halo charges left at the current gate; refills to full on a new gate. */
  crackedHaloCharges: number;
  /** Consecutive made bids (this run, not just this gate); resets on any miss. Feeds Ledger of Wrath. */
  madeStreak: number;
  /** The starting deck identity chosen at the home screen (see decks.ts). */
  deckId: DeckId;
  /** How the most recent hand landed, for table feedback. */
  lastHand: {
    made: boolean;
    dmgDealt: number;
    /** miss-strike damage on a miss; the small made-bid trickle (see `scoreMadeBidTrickle`) on a made bid */
    dmgTaken: number;
    respawned: boolean;
    won: boolean;
    /** who the blow landed on, and whether it killed them */
    targetName?: string;
    felled?: boolean;
    /** chips × mult breakdown behind dmgDealt (made bids only) */
    score?: StrikeScore;
    /** chips × mult breakdown behind dmgTaken (missed bids only) */
    demonScore?: DemonStrikeScore;
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
      // The last gate is a fixed finale, not a pool roll: one card, no
      // gimmick, just whatever the run built you into (see docs/SCORING.md).
      demonId: region === 'bottom' ? 'adversary' : i === STOP_COUNT - 1 ? 'warden' : pick(rng, demonPool(i)),
      shopAfter: i % 3 === 2 && i !== STOP_COUNT - 1
    });
  }
  return stops;
}

export function newRun(seed = Math.floor(Math.random() * 2 ** 31), deckId: DeckId = 'standard'): RunState {
  const deckDef = DECKS[deckId];
  const maxGrace = deckDef.maxGrace ?? 3;
  const maxHp = deckDef.maxHp ?? PLAYER_MAX_HP;
  const run: RunState = {
    seed,
    stopIndex: 0,
    grace: maxGrace,
    maxGrace,
    hp: maxHp,
    maxHp,
    demonHps: demonMaxHpsFor(buildTrack(seed)[0], deckDef.startRelics),
    souls: deckDef.startSouls ?? 0,
    relics: [],
    attempts: 0,
    phase: 'map',
    shopOffers: [],
    shopRerolled: false,
    log: ['You wake at the gate.'],
    deck: buildDeck(),
    crackedHaloCharges: CRACKED_HALO_CHARGES_PER_GATE,
    madeStreak: 0,
    deckId,
    lastHand: null
  };
  for (const id of deckDef.startRelics) {
    run.relics.push(id);
    applyRelicEffects(run, id);
  }
  if (deckId !== 'standard') run.log.push(`${deckDef.name}: ${deckDef.hook}`);
  return run;
}

/** Enchants a specific card in the persistent deck. The enchant rides the card wherever it's dealt. */
export function enchantCard(run: RunState, cardId: string, enchant: EnchantId): RunState {
  return { ...run, deck: run.deck.map((c) => (c.id === cardId ? { ...c, enchant } : c)) };
}

/**
 * Removes a card from the persistent deck permanently (Pact of Ruin). The
 * deck can never shrink below `MIN_DECK_SIZE` — the biggest gate still needs
 * enough cards for a full table.
 */
export function destroyCard(run: RunState, cardId: string): RunState {
  if (run.deck.length - 1 < MIN_DECK_SIZE) {
    throw new Error('The deck is too thin for a full table to survive losing another card');
  }
  if (!run.deck.some((c) => c.id === cardId)) throw new Error('No such card');
  return { ...run, deck: run.deck.filter((c) => c.id !== cardId) };
}

/** Adds an exact copy of a card to the persistent deck (Pact of Echoes), capped at `MAX_DECK_SIZE`. */
export function duplicateCard(run: RunState, cardId: string): RunState {
  if (run.deck.length + 1 > MAX_DECK_SIZE) throw new Error('The deck cannot hold any more copies');
  const card = run.deck.find((c) => c.id === cardId);
  if (!card) throw new Error('No such card');
  const dupIndex = run.deck.filter((c) => c.id.startsWith(`${card.id}-dup`)).length + 1;
  return { ...run, deck: [...run.deck, { ...card, id: `${card.id}-dup${dupIndex}` }] };
}

/** Clears a card's enchant — shop-only, and only for a Cursed card (see `applyCorruption`). */
export function cleanseCard(run: RunState, cardId: string): RunState {
  if (run.phase !== 'shop') throw new Error('No shop here');
  if (run.souls < CLEANSE_COST) throw new Error('Not enough souls');
  const card = run.deck.find((c) => c.id === cardId);
  if (!card || card.enchant !== 'cursed') throw new Error('Nothing to cleanse there');
  return {
    ...run,
    souls: run.souls - CLEANSE_COST,
    deck: run.deck.map((c) => (c.id === cardId ? { ...c, enchant: undefined } : c)),
    log: [
      ...run.log,
      `Cleansed the ${rankLabel(card.rank)} of ${SUIT_NAMES[card.suit]} for ${CLEANSE_COST} souls.`
    ]
  };
}

/**
 * Demons scar the deck on the way down: clearing a hell stop has a chance to
 * curse a random unenchanted card. Shops can cleanse it back off; left alone,
 * it costs you chips when you win with it and feeds the table's counter-strike
 * when a demon does instead (see `scoreStrike` / `scoreDemonStrike`).
 */
function applyCorruption(run: RunState, stop: StopDef): void {
  const rng = mulberry32(run.seed ^ (stop.index * 104729) ^ 0xc02710d);
  if (rng() >= CORRUPTION_CHANCE) return;
  const candidates = run.deck.filter((c) => !c.enchant);
  if (candidates.length === 0) return;
  const card = pick(rng, candidates);
  run.deck = run.deck.map((c) => (c.id === card.id ? { ...c, enchant: 'cursed' } : c));
  run.log.push(
    `A demon's claw drags across the ${rankLabel(card.rank)} of ${SUIT_NAMES[card.suit]} — it curdles, cursed.`
  );
}

/**
 * Pact of Sealing: choose a card and an enchantment to seal into it.
 * Only unenchanted cards can be sealed — one mark per card.
 */
export function usePactSeal(run: RunState, cardId: string, enchant: EnchantId): RunState {
  if (run.phase !== 'map') throw new Error('Pacts are spent between fights, not here');
  if (!run.relics.includes('pactSeal')) throw new Error('No Pact of Sealing to spend');
  const card = run.deck.find((c) => c.id === cardId);
  if (!card) throw new Error('No such card');
  if (card.enchant) throw new Error('That card is already enchanted');
  const sealed = enchantCard(consumeRelic(run, 'pactSeal'), cardId, enchant);
  return {
    ...sealed,
    log: [
      ...sealed.log,
      `The Pact of Sealing marks the ${rankLabel(card.rank)} of ${SUIT_NAMES[card.suit]} — ${ENCHANTMENTS[enchant].name} now.`
    ]
  };
}

/** Pact of Ruin: choose a card and burn it out of the deck permanently. */
export function usePactRuin(run: RunState, cardId: string): RunState {
  if (run.phase !== 'map') throw new Error('Pacts are spent between fights, not here');
  if (!run.relics.includes('pactRuin')) throw new Error('No Pact of Ruin to spend');
  const card = run.deck.find((c) => c.id === cardId);
  if (!card) throw new Error('No such card');
  const ruined = destroyCard(consumeRelic(run, 'pactRuin'), cardId);
  return {
    ...ruined,
    log: [
      ...ruined.log,
      `The Pact of Ruin burns the ${rankLabel(card.rank)} of ${SUIT_NAMES[card.suit]} out of the deck.`
    ]
  };
}

/** Pact of Echoes: choose a card and add an exact copy of it to the deck. */
export function usePactEcho(run: RunState, cardId: string): RunState {
  if (run.phase !== 'map') throw new Error('Pacts are spent between fights, not here');
  if (!run.relics.includes('pactEcho')) throw new Error('No Pact of Echoes to spend');
  const card = run.deck.find((c) => c.id === cardId);
  if (!card) throw new Error('No such card');
  const echoed = duplicateCard(consumeRelic(run, 'pactEcho'), cardId);
  return {
    ...echoed,
    log: [...echoed.log, `The Pact of Echoes doubles the ${rankLabel(card.rank)} of ${SUIT_NAMES[card.suit]}.`]
  };
}

/** Immediate (non-passive) effects a relic applies when gained. */
function applyRelicEffects(run: RunState, id: RelicId): void {
  if (id === 'secondSoul') {
    run.maxGrace += 1;
    run.grace = Math.min(run.maxGrace, run.grace + 1);
  }
  if (id === 'emberedPact') {
    const candidates = run.deck.filter((c) => !c.enchant);
    if (candidates.length > 0) {
      const rng = mulberry32(run.seed ^ (run.attempts * 7919 + run.relics.length) ^ 0xe3bed);
      const card = pick(rng, candidates);
      run.deck = run.deck.map((c) => (c.id === card.id ? { ...c, enchant: 'gilded' } : c));
      run.log.push(
        `The pact seals into the ${rankLabel(card.rank)} of ${SUIT_NAMES[card.suit]} — it turns gilded.`
      );
    }
  }
}

/** Souls earned for a made bid ride the strike: a harder blow shakes more loose. */
export function soulsForClear(damage: number): number {
  return 3 + Math.floor(damage / 10);
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
 * Apply damage to the player's HP; on lethal, catches with grace (-1 grace,
 * full HP) unless grace is spent, which ends the run. Mutates `next` in
 * place; shared by both the miss strike and the made-bid trickle below so
 * the grace/death rule only lives in one place.
 */
function settleDamage(next: RunState, dmg: number): 'alive' | 'respawned' | 'dead' {
  if (dmg <= 0) return 'alive';
  next.hp -= dmg;
  if (next.hp > 0) return 'alive';
  next.hp = 0;
  next.grace -= 1;
  if (next.grace <= 0) {
    next.grace = 0;
    next.phase = 'dead';
    return 'dead';
  }
  next.hp = next.maxHp;
  return 'respawned';
}

/**
 * Apply the outcome of a played hand at the current stop's battle.
 * Made bid → a scored strike at a chosen living demon: (base + trick chips)
 * × bid mult (see scoring.ts); fell it and it leaves the table. The gate
 * clears when every demon is down. Consecutive makes feed Ledger of Wrath;
 * a fell demon feeds Reliquary's permanent max-HP gain. The table still
 * claws back a small flat nick per trick the demons won this hand, even
 * though you made your bid (see `scoreMadeBidTrickle`) — otherwise how well
 * the demons played was invisible as long as your own count landed.
 * Missed → the table strikes back, scored the same way: (base + demon
 * tricks) × miss mult (see `scoreDemonStrike`) — the Usurer doubles it while
 * it lives, Ashen Shield blocks, Cracked Halo voids a miss-by-one both ways
 * (once per gate). At 0 HP, grace catches you: -1 grace, full HP, and the
 * demons keep their wounds. At 0 grace the pit keeps you.
 */
export function resolveHand(
  run: RunState,
  track: StopDef[],
  outcome: { bid: number; taken: number; target?: number; wins?: TrickWin[]; demonWins?: TrickWin[] }
): RunState {
  if (run.phase !== 'map') throw new Error(`Cannot resolve a hand during ${run.phase}`);
  const stop = track[run.stopIndex];
  const next: RunState = {
    ...run,
    demonHps: run.demonHps.slice(),
    attempts: run.attempts + 1,
    log: run.log.slice()
  };
  const made = outcome.bid === outcome.taken;

  if (made) {
    const target = outcome.target;
    if (target == null || run.demonHps[target] === undefined || run.demonHps[target] <= 0) {
      throw new Error('A made bid must strike a living demon');
    }
    const roster = rosterFor(stop);
    const targetName = roster[target].name;
    const streak = run.madeStreak + 1;
    const score = scoreStrike(outcome.bid, outcome.wins ?? [], run.relics, streak);
    const dmg = score.total;
    const earned = soulsForClear(dmg);
    next.madeStreak = streak;
    next.demonHps[target] = Math.max(0, next.demonHps[target] - dmg);
    next.souls += earned;
    const felled = next.demonHps[target] === 0;
    if (felled) {
      if (run.relics.includes('reliquary')) next.maxHp += RELIQUARY_HP_PER_FELL;
      next.hp = Math.min(next.maxHp, next.hp + FELL_HEAL);
    }

    let trickle = scoreMadeBidTrickle(outcome.demonWins ?? []);
    if (trickle > 0 && run.relics.includes('ashenShield')) trickle = Math.max(1, trickle - ASHEN_SHIELD_BLOCK);
    const trickleResult = settleDamage(next, trickle);

    if (trickleResult === 'dead') {
      next.lastHand = {
        made,
        dmgDealt: dmg,
        dmgTaken: trickle,
        respawned: false,
        won: false,
        targetName,
        felled,
        score
      };
      next.log.push(
        `${targetName} takes ${dmg}${felled ? ', and falls' : ''} — but the table claws back ${trickle} as ` +
          `you strike. You fall at ${stop.label}. Your last grace gutters out. The pit keeps you.`
      );
      return next;
    }

    const won = next.demonHps.every((hp) => hp === 0);
    next.lastHand = {
      made,
      dmgDealt: dmg,
      dmgTaken: trickle,
      respawned: trickleResult === 'respawned',
      won,
      targetName,
      felled,
      score
    };
    if (won) {
      if (stop.region === 'bottom') next.souls += BOSS_BOUNTY;
      next.log.push(
        `${targetName} falls, and ${stop.label} with it: ${dmg} damage. +${earned}${
          stop.region === 'bottom' ? ` souls and a ${BOSS_BOUNTY}-soul bounty` : ' souls'
        }.`
      );
      if (trickle > 0) {
        next.log.push(
          trickleResult === 'respawned'
            ? `The table claws back ${trickle} as you strike — grace catches you. -1 grace (${next.grace} left).`
            : `The table claws back ${trickle} as you strike.`
        );
      }
      return advance(next, track, stop);
    }
    next.log.push(
      felled
        ? `${targetName} falls at ${stop.label}: ${dmg} damage. It leaves the table. +${earned} souls, +${FELL_HEAL} HP.`
        : `${targetName} takes ${dmg} at ${stop.label} (${next.demonHps[target]} HP left). +${earned} souls.`
    );
    if (felled && target === 0) {
      next.log.push(`The table's master is slain — its rule dies with it.`);
    }
    if (trickle > 0) {
      next.log.push(
        trickleResult === 'respawned'
          ? `The table claws back ${trickle} as you strike — grace catches you. -1 grace (${next.grace} left).`
          : `The table claws back ${trickle} as you strike (${next.hp} HP left).`
      );
    }
    return next;
  }

  next.madeStreak = 0;

  const haloSaves = run.relics.includes('crackedHalo') && Math.abs(outcome.bid - outcome.taken) === 1;
  if (haloSaves && run.crackedHaloCharges > 0) {
    next.crackedHaloCharges = run.crackedHaloCharges - 1;
    next.lastHand = { made, dmgDealt: 0, dmgTaken: 0, respawned: false, won: false };
    next.log.push(`Missed by one at ${stop.label} — the Cracked Halo holds. No blood drawn.`);
    return next;
  }

  const missBy = Math.abs(outcome.bid - outcome.taken);
  const demonScore = scoreDemonStrike(outcome.demonWins ?? [], missBy);
  let dmg = demonScore.total;
  if (stop.demonId === 'usurer' && leadAlive(run)) dmg *= 2;
  if (run.relics.includes('ashenShield')) dmg = Math.max(1, dmg - ASHEN_SHIELD_BLOCK);
  const result = settleDamage(next, dmg);

  if (result === 'dead') {
    next.lastHand = { made, dmgDealt: 0, dmgTaken: dmg, respawned: false, won: false, demonScore };
    next.log.push(`You fall at ${stop.label}. Your last grace gutters out. The pit keeps you.`);
    return next;
  }
  if (result === 'respawned') {
    next.lastHand = { made, dmgDealt: 0, dmgTaken: dmg, respawned: true, won: false, demonScore };
    next.log.push(
      `You fall at ${stop.label} — grace catches you. -1 grace (${next.grace} left), and the fight goes on.`
    );
    return next;
  }
  next.lastHand = { made, dmgDealt: 0, dmgTaken: dmg, respawned: false, won: false, demonScore };
  next.log.push(
    `Missed at ${stop.label}: bid ${outcome.bid}, took ${outcome.taken}. ${dmg} damage, ${next.hp} HP left.`
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
  run.demonHps = demonMaxHpsFor(track[run.stopIndex], run.relics);
  run.crackedHaloCharges = CRACKED_HALO_CHARGES_PER_GATE;
  if (stop.region === 'hell') applyCorruption(run, stop);
  if (stop.shopAfter) {
    run.phase = 'shop';
    run.shopOffers = shopStock(run);
    run.shopRerolled = false;
    run.log.push('A lantern in the dark: a shop.');
  }
  return run;
}

/**
 * Three unowned relics, seeded per visit, weighted by tier (`TIER_WEIGHT`) so
 * common relics show up most and legendary rarest. `salt` distinguishes a
 * reroll's draw from the original visit's without changing either's
 * determinism from the run seed (see `rerollShop`).
 */
function shopStock(run: RunState, salt = 0): RelicId[] {
  const rng = mulberry32(run.seed ^ (run.stopIndex * 7919) ^ (salt * 104729));
  let available = ALL_RELIC_IDS.filter((id) => !run.relics.includes(id) || RELICS[id].consumable);
  const stock: RelicId[] = [];
  while (stock.length < 3 && available.length > 0) {
    const candidate = pickWeighted(rng, available, (id) => TIER_WEIGHT[RELICS[id].tier]);
    stock.push(candidate);
    available = available.filter((id) => id !== candidate);
  }
  return stock;
}

/** Rerolling the shop costs souls but leaves with a fresh weighted draw — one use per visit. */
export const REROLL_COST = 6;

export function rerollShop(run: RunState): RunState {
  if (run.phase !== 'shop') throw new Error('No shop here');
  if (run.shopRerolled) throw new Error('Already rerolled this shop');
  if (run.souls < REROLL_COST) throw new Error('Not enough souls');
  const next: RunState = {
    ...run,
    souls: run.souls - REROLL_COST,
    shopRerolled: true,
    log: [...run.log, `Spent ${REROLL_COST} souls to reroll the shop.`]
  };
  next.shopOffers = shopStock(next, 1);
  return next;
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
  if (relic.instant) next.relics = next.relics.slice(0, -1);
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
  return { ...run, phase: 'map', shopOffers: [], shopRerolled: false };
}

/**
 * A stand-in for "an averagely-bold made bid" at this hand size, run through
 * the real scoring formula (relics included) so a dev-cleared gate pays out
 * souls on the same curve a played one would. Used only by `devClearGate`.
 */
function devSyntheticStrike(stop: StopDef, relics: RelicId[]): StrikeScore {
  const bid = Math.max(1, Math.ceil(stop.handSize / 2));
  const wins: TrickWin[] = Array.from({ length: bid }, () => ({ rank: 10, suit: 'S', trump: false }));
  return scoreStrike(bid, wins, relics);
}

/**
 * Dev shortcut: clear the current gate as if it had been played out — every
 * demon takes synthetic strikes (see `devSyntheticStrike`) until it falls, so
 * souls (and the boss bounty) land the same way a real clear would. Lets a
 * tester walk the whole run — shops, relics, the economy — without grinding
 * real hands. TEMPORARY.
 */
export function devClearGate(run: RunState, track: StopDef[]): RunState {
  if (run.phase !== 'map') throw new Error('Can only clear a gate from the map');
  const stop = track[run.stopIndex];
  const strike = devSyntheticStrike(stop, run.relics);
  let soulsEarned = 0;
  let strikes = 0;
  const demonHps = run.demonHps.map((hp) => {
    let remaining = hp;
    while (remaining > 0) {
      remaining -= strike.total;
      soulsEarned += soulsForClear(strike.total);
      strikes++;
    }
    return 0;
  });
  const next: RunState = {
    ...run,
    demonHps,
    souls: run.souls + soulsEarned,
    log: [
      ...run.log,
      `⚙ ${stop.label} waved through (dev): ${strikes} synthetic strikes, +${soulsEarned} souls.`
    ]
  };
  if (stop.region === 'bottom') next.souls += BOSS_BOUNTY;
  return advance(next, track, stop);
}

/**
 * Removes one instance of a consumable relic outside the normal map/shop
 * flow — for relics used mid-hand (Trump Anchor) where the battle itself is
 * driven by local component state, not `resolveHand`.
 */
export function consumeRelic(run: RunState, id: RelicId): RunState {
  const idx = run.relics.indexOf(id);
  if (idx === -1) throw new Error('No such relic to spend');
  return { ...run, relics: run.relics.filter((_, i) => i !== idx) };
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
