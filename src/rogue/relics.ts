/**
 * Relics: the run-warping layer. Information is the primary power axis —
 * bid-tolerance effects are the rare tier (see docs/ROGUELITE-CONCEPT.md).
 */

export type RelicId =
  | 'loadedDie'
  | 'graveLedger'
  | 'secondSoul'
  | 'crackedHalo'
  | 'ferrymansCoin'
  | 'emberBrand'
  | 'ashenShield'
  | 'devilsLettuce'
  | 'trumpVision'
  | 'trumpAnchor'
  | 'pyre'
  | 'zerosCrown'
  | 'heraldHearts'
  | 'heraldDiamonds'
  | 'heraldClubs'
  | 'heraldSpades'
  | 'ledgerOfWrath'
  | 'reliquary'
  | 'emberedPact'
  | 'pactSeal'
  | 'pactRuin'
  | 'pactEcho';

export type RelicTier = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RelicDef {
  id: RelicId;
  name: string;
  flavor: string;
  effect: string;
  tier: RelicTier;
  cost: number;
  /** consumed on use (map action, or a hand action) rather than passive */
  consumable?: boolean;
  /** applies once at acquisition and is never actually held — doesn't sit in the tray */
  instant?: boolean;
}

/** Cracked Halo: one no-damage miss-by-one per gate, not an unlimited passive. */
export const CRACKED_HALO_CHARGES_PER_GATE = 1;
/** Reliquary: permanent max-HP gain per demon felled this run. */
export const RELIQUARY_HP_PER_FELL = 1;

export const RELICS: Record<RelicId, RelicDef> = {
  loadedDie: {
    id: 'loadedDie',
    name: 'Loaded Die',
    flavor: 'It always lands the way the pit reads.',
    effect: 'See the trump card while bidding on deep hands (4+ cards), where it normally stays face-down until bids are locked. The demons already know it.',
    tier: 'common',
    cost: 8
  },
  graveLedger: {
    id: 'graveLedger',
    name: 'Grave Ledger',
    flavor: 'Every card played is a name entered.',
    effect: 'Shows a running count of trumps played this hand.',
    tier: 'common',
    cost: 10
  },
  secondSoul: {
    id: 'secondSoul',
    name: 'Second Soul',
    flavor: 'Someone left it behind. It fits.',
    effect: '+1 max grace, and restores 1 grace when taken.',
    tier: 'uncommon',
    cost: 12
  },
  crackedHalo: {
    id: 'crackedHalo',
    name: 'Cracked Halo',
    flavor: 'Still counts, mostly.',
    effect:
      'Once per gate, missing your bid by exactly one deals no damage to you — but none to the demon either.',
    tier: 'legendary',
    cost: 18
  },
  ferrymansCoin: {
    id: 'ferrymansCoin',
    name: "Ferryman's Coin",
    flavor: 'One crossing, no questions.',
    effect: 'Skip a stop without playing it (no souls earned). Consumed on use. The ferryman will not row past the Adversary.',
    tier: 'uncommon',
    cost: 15,
    consumable: true
  },
  emberBrand: {
    id: 'emberBrand',
    name: 'Ember Brand',
    flavor: 'It remembers being a sword.',
    effect: 'Made bids strike with +1 mult.',
    tier: 'uncommon',
    cost: 12
  },
  ashenShield: {
    id: 'ashenShield',
    name: 'Ashen Shield',
    flavor: 'What has burned cannot burn again.',
    effect: 'Missed bids deal 2 less damage to you (never below 1).',
    tier: 'uncommon',
    cost: 12
  },
  devilsLettuce: {
    id: 'devilsLettuce',
    name: "🥬 The Devil's Lettuce",
    flavor: 'One puff and the cards sweat their secrets.',
    effect: "Smoke curls from the backs of demons' high cards — queens, kings, and aces.",
    tier: 'rare',
    cost: 14
  },
  trumpVision: {
    id: 'trumpVision',
    name: 'Trump Vision',
    flavor: 'The pit burns hottest where it matters.',
    effect: "Demons' trumps smolder through the backs of their cards.",
    tier: 'uncommon',
    cost: 12
  },
  trumpAnchor: {
    id: 'trumpAnchor',
    name: 'Trump Anchor',
    flavor: 'One suit, driven in like a nail.',
    effect:
      'Once per hand, lock trump to a suit of your choice for the rest of the hand — overrides even the Adversary\'s shift. Consumed on use.',
    tier: 'rare',
    cost: 16,
    consumable: true
  },
  pyre: {
    id: 'pyre',
    name: 'Pyre',
    flavor: 'It remembers every trump that fed it.',
    effect: '+1 mult per trump trick you win this hand.',
    tier: 'uncommon',
    cost: 10
  },
  zerosCrown: {
    id: 'zerosCrown',
    name: "Zero's Crown",
    flavor: 'Nothing, worn like a victory.',
    effect: 'A made 0-bid strikes at ×3 mult instead of ×1.',
    tier: 'rare',
    cost: 14
  },
  heraldHearts: {
    id: 'heraldHearts',
    name: 'Herald of Hearts',
    flavor: 'It sings for the red suits it loves best.',
    effect: 'Tricks you win in Hearts score double chips.',
    tier: 'uncommon',
    cost: 11
  },
  heraldDiamonds: {
    id: 'heraldDiamonds',
    name: 'Herald of Diamonds',
    flavor: 'It counts what glitters.',
    effect: 'Tricks you win in Diamonds score double chips.',
    tier: 'uncommon',
    cost: 11
  },
  heraldClubs: {
    id: 'heraldClubs',
    name: 'Herald of Clubs',
    flavor: 'It remembers being a weapon.',
    effect: 'Tricks you win in Clubs score double chips.',
    tier: 'uncommon',
    cost: 11
  },
  heraldSpades: {
    id: 'heraldSpades',
    name: 'Herald of Spades',
    flavor: 'It digs in and does not let go.',
    effect: 'Tricks you win in Spades score double chips.',
    tier: 'uncommon',
    cost: 11
  },
  ledgerOfWrath: {
    id: 'ledgerOfWrath',
    name: 'Ledger of Wrath',
    flavor: 'Every debt paid on time, and then some.',
    effect: '+4 chips per consecutive made bid (this one included). Resets on a miss.',
    tier: 'rare',
    cost: 15
  },
  reliquary: {
    id: 'reliquary',
    name: 'Reliquary',
    flavor: 'A shard of every demon you\'ve felled, worn close.',
    effect: '+1 max HP, permanently, whenever you fell a demon.',
    tier: 'uncommon',
    cost: 13
  },
  emberedPact: {
    id: 'emberedPact',
    name: 'Embered Pact',
    flavor: 'A price paid into the deck itself, not your hand.',
    effect: 'Enchants a random card in your deck Gilded (+6 chips when it wins a trick for you).',
    tier: 'rare',
    cost: 14,
    consumable: true,
    instant: true
  },
  pactSeal: {
    id: 'pactSeal',
    name: 'Pact of Sealing',
    flavor: 'Name the mark. Name the card.',
    effect: 'Choose an enchantment and a card in your deck to seal it into. Consumed on use.',
    tier: 'rare',
    cost: 16,
    consumable: true
  },
  pactRuin: {
    id: 'pactRuin',
    name: 'Pact of Ruin',
    flavor: 'Some cards are better as ash.',
    effect:
      'Choose a card in your deck and remove it permanently (the deck never shrinks below what a full table needs). Consumed on use.',
    tier: 'uncommon',
    cost: 13,
    consumable: true
  },
  pactEcho: {
    id: 'pactEcho',
    name: 'Pact of Echoes',
    flavor: 'It liked being dealt. It wants to happen again.',
    effect: 'Choose a card in your deck and add an exact copy of it. Consumed on use.',
    tier: 'rare',
    cost: 17,
    consumable: true
  }
};

export const ALL_RELIC_IDS = Object.keys(RELICS) as RelicId[];
