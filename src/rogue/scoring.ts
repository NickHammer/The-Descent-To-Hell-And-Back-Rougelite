/**
 * Strike scoring: a made bid is a scoring event, not a flat hit.
 *
 *   damage = (BASE_CHIPS + trick chips) × mult
 *
 * Chips come from trick quality — each trick you win adds the rank of the
 * card that won it — and mult comes from bid boldness. Two axes so the
 * product can grow: relics and card enchantments feed one side or the
 * other, and the machine the player builds is what makes numbers explode.
 * See docs/SCORING.md for the design and roadmap.
 */
import { Suit } from '../shared/types.js';
import { RelicId } from './relics.js';

/**
 * Card enchantments: persistent, keyed to a card's identity in `RunState.deck`.
 * Positive ones (gilded, royal, blazing, marked) are sealed in via Shop Pacts or
 * Embered Pact. Cursed is the negative one — demons scar cards on the way down
 * through hell (`applyCorruption` in run.ts); shops can cleanse it back off.
 */
export type EnchantId = 'gilded' | 'royal' | 'blazing' | 'marked' | 'cursed';
/** +chips when a Gilded card wins a trick for you. */
export const GILDED_CHIPS = 6;
/** -chips (floored at 0) when a Cursed card wins a trick for you. */
export const CURSED_CHIPS_PENALTY = 4;
/** +mult when a Marked card wins a trick for you. */
export const MARKED_MULT = 0.5;
/** +demon mult per Cursed card a demon wins a trick with — the cost of leaving a curse in the deck. */
export const CURSED_DEMON_MULT = 0.3;

export const ENCHANTMENTS: Record<EnchantId, { name: string; flavor: string; effect: string }> = {
  gilded: {
    name: 'Gilded',
    flavor: 'A pact sealed into the card itself.',
    effect: `+${GILDED_CHIPS} chips when it wins a trick for you.`
  },
  royal: {
    name: 'Royal',
    flavor: 'It forgot what it was dealt as.',
    effect: 'Counts as an Ace (rank 14) for chips when it wins a trick for you.'
  },
  blazing: {
    name: 'Blazing',
    flavor: 'It burns like it was always trump.',
    effect: 'Always counts as a trump win when it wins a trick for you.'
  },
  marked: {
    name: 'Marked',
    flavor: 'Every table remembers this one.',
    effect: `+${MARKED_MULT} mult when it wins a trick for you.`
  },
  cursed: {
    name: 'Cursed',
    flavor: "A demon's claw dragged across it on the way down.",
    effect: `-${CURSED_CHIPS_PENALTY} chips when it wins a trick for you, and feeds the table's counter-strike when a demon wins with it instead. Shops can cleanse it.`
  }
};

/** Hover text for an enchanted card (name + effect), or undefined for a plain one. */
export function enchantTitle(enchant?: string): string | undefined {
  if (!enchant || !(enchant in ENCHANTMENTS)) return undefined;
  const e = ENCHANTMENTS[enchant as EnchantId];
  return `${e.name}: ${e.effect}`;
}

/** One trick the player won: the card it was won with, as scoring material. */
export interface TrickWin {
  rank: number; // 2-14
  suit: Suit;
  /** won with a trump (against the trump suit in force at that trick) */
  trump: boolean;
  /** the enchantment on the winning card, if any (see `RunState.deck`) */
  enchant?: string;
}

/** A made 0-bid still lands this many chips at ×1. */
export const BASE_CHIPS = 10;
/** Each point of bid adds this much mult on top of ×1. */
export const MULT_PER_BID = 0.5;
/** Ember Brand: the first mult relic. */
export const EMBER_BRAND_MULT = 1;
/** Zero's Crown: replaces the ×1 base mult on a made 0-bid. */
export const ZEROS_CROWN_MULT = 3;
/** Pyre: +mult per trump trick you won this hand. */
export const PYRE_MULT_PER_TRUMP_WIN = 1;
/** Ledger of Wrath: +chips per consecutive made bid (this one included), reset on a miss. */
export const LEDGER_CHIPS_PER_STREAK = 4;
/** The streak Ledger of Wrath scores off of stops climbing here — an unbroken run gets rewarded, not an infinite snowball. */
export const LEDGER_STREAK_CAP = 10;
/** Herald of $Suit: tricks won in that suit score double chips. */
const HERALD_BY_SUIT: Record<Suit, RelicId> = {
  H: 'heraldHearts',
  D: 'heraldDiamonds',
  C: 'heraldClubs',
  S: 'heraldSpades'
};

export interface StrikeScore {
  baseChips: number;
  trickChips: number; // trick quality + herald doubling + enchant bonuses + streak bonus
  chips: number; // baseChips + trickChips
  mult: number;
  total: number; // round(chips × mult) — the damage dealt
}

export function scoreStrike(
  bid: number,
  wins: TrickWin[],
  relics: RelicId[],
  madeStreak = 0
): StrikeScore {
  const winChips = wins.reduce((sum, w) => {
    const rank = w.enchant === 'royal' ? 14 : w.rank;
    let chip = relics.includes(HERALD_BY_SUIT[w.suit]) ? rank * 2 : rank;
    if (w.enchant === 'gilded') chip += GILDED_CHIPS;
    if (w.enchant === 'cursed') chip = Math.max(0, chip - CURSED_CHIPS_PENALTY);
    return sum + chip;
  }, 0);
  const streakChips = relics.includes('ledgerOfWrath')
    ? LEDGER_CHIPS_PER_STREAK * Math.min(madeStreak, LEDGER_STREAK_CAP)
    : 0;
  const trickChips = winChips + streakChips;
  const chips = BASE_CHIPS + trickChips;
  let mult = bid === 0 && relics.includes('zerosCrown') ? ZEROS_CROWN_MULT : 1 + MULT_PER_BID * bid;
  if (relics.includes('emberBrand')) mult += EMBER_BRAND_MULT;
  const trumpWins = wins.filter((w) => w.trump || w.enchant === 'blazing').length;
  if (relics.includes('pyre')) mult += PYRE_MULT_PER_TRUMP_WIN * trumpWins;
  mult += MARKED_MULT * wins.filter((w) => w.enchant === 'marked').length;
  return {
    baseChips: BASE_CHIPS,
    trickChips,
    chips,
    mult,
    total: Math.round(chips * mult)
  };
}

export const DEMON_BASE_CHIPS = 2;
/** Each point you missed by adds this much to the table's mult. */
export const DEMON_MULT_PER_MISS = 0.2;
/** The table's mult can't climb past this — an all-in whiff is scary, not a guaranteed kill. */
export const DEMON_MULT_CAP = 2.5;

export interface DemonStrikeScore {
  baseChips: number;
  trickChips: number; // count of tricks the demons won this hand (not rank sum — see docs/SCORING.md)
  chips: number;
  mult: number;
  total: number; // round(chips × mult) — the damage taken
}

/**
 * The table's counter-strike on a missed bid: the same chips × mult shape as
 * your own strike, but fed by what actually happened — chips from how many
 * tricks the demons won this hand, mult from how badly you missed (plus a
 * bump per Cursed card a demon won a trick with — the cost of not cleansing
 * a curse). A close call stings less than a wild overbid. Chips deliberately
 * count tricks, not summed rank: player HP is a small, tightly-bounded
 * resource (~14), unlike demon HP pools (16-195) built to absorb big
 * chip×mult numbers.
 */
export function scoreDemonStrike(demonWins: TrickWin[], missBy: number): DemonStrikeScore {
  const trickChips = demonWins.length;
  const chips = DEMON_BASE_CHIPS + trickChips;
  const cursedWins = demonWins.filter((w) => w.enchant === 'cursed').length;
  const mult = Math.min(DEMON_MULT_CAP, 1 + DEMON_MULT_PER_MISS * missBy + CURSED_DEMON_MULT * cursedWins);
  return {
    baseChips: DEMON_BASE_CHIPS,
    trickChips,
    chips,
    mult,
    total: Math.round(chips * mult)
  };
}

/** Damage per demon trick win, even on a made bid. */
export const MADE_BID_TRICKLE_PER_DEMON_TRICK = 0.5;
/** A made bid stays the safe line — this can never spike past a small nick. */
export const MADE_BID_TRICKLE_CAP = 4;

/**
 * A made bid strikes the table (see `scoreStrike`), but a demon that stole
 * tricks around your made count used to cost you nothing — the imps could
 * play the hand well or badly and it never showed. This is the counterweight:
 * flat, small, no base chips, no mult, capped well under a full miss — so
 * making your bid stays clearly the safe line, but a table that steals half
 * the hand around you still draws a little blood.
 */
export function scoreMadeBidTrickle(demonWins: TrickWin[]): number {
  return Math.min(MADE_BID_TRICKLE_CAP, Math.round(MADE_BID_TRICKLE_PER_DEMON_TRICK * demonWins.length));
}
