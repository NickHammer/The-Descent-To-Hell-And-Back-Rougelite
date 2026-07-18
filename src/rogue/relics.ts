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
  | 'ashenShield';

export type RelicTier = 'common' | 'uncommon' | 'rare';

export interface RelicDef {
  id: RelicId;
  name: string;
  flavor: string;
  effect: string;
  tier: RelicTier;
  cost: number;
  /** consumed on use (map action) rather than passive */
  consumable?: boolean;
}

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
    effect: 'Missing your bid by exactly one deals no damage to you — but none to the demon either.',
    tier: 'rare',
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
    effect: 'Made bids strike for +3 damage.',
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
  }
};

export const ALL_RELIC_IDS = Object.keys(RELICS) as RelicId[];
