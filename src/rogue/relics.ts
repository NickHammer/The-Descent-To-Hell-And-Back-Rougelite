/**
 * Relics: the run-warping layer. Information is the primary power axis —
 * bid-tolerance effects are the rare tier (see docs/ROGUELITE-CONCEPT.md).
 */

export type RelicId =
  | 'loadedDie'
  | 'graveLedger'
  | 'secondSoul'
  | 'crackedHalo'
  | 'ferrymansCoin';

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
    effect: 'See the trump card while bidding. (Normally it stays face-down until bids are locked — the demons already know it.)',
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
    effect: 'Missing your bid by exactly one costs no grace (but earns no souls).',
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
  }
};

export const ALL_RELIC_IDS = Object.keys(RELICS) as RelicId[];
