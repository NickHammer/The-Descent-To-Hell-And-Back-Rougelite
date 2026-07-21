/**
 * Starting decks: a run-layer identity chosen at the home screen. See
 * DECKS.md for the full brainstorm — this ships the three that are pure
 * `RunState` configuration (no engine deck-composition work, no risk to the
 * card-count floor multi-hand gates need). `deckBuild`-style decks (Stripped,
 * Two-Headed, ...) stay a later slice; DECKS.md's own math for a 36-card
 * Stripped Deck is short of what a 4-seat 10-card gate needs (see run.ts's
 * `MIN_DECK_SIZE`), so that one needs a rework before it can ship at all.
 */
import { RelicId } from './relics.js';

export type DeckId = 'standard' | 'gamblers' | 'ashen';

export interface DeckDef {
  id: DeckId;
  name: string;
  hook: string;
  startRelics: RelicId[];
  maxGrace?: number; // default 3
  maxHp?: number; // default PLAYER_MAX_HP
  startSouls?: number; // default 0
}

export const DECKS: Record<DeckId, DeckDef> = {
  standard: {
    id: 'standard',
    name: 'Standard Deck',
    hook: 'The baseline 52. What the game is today.',
    startRelics: []
  },
  gamblers: {
    id: 'gamblers',
    name: "Gambler's Deck",
    hook: 'You arrived in debt. Buy your safety early, or die fast.',
    startRelics: [],
    maxGrace: 2,
    startSouls: 12
  },
  ashen: {
    id: 'ashen',
    name: 'Ashen Deck',
    hook: 'Already burned once. Aggressive and brittle.',
    startRelics: ['emberBrand', 'ashenShield'],
    maxHp: 10
  }
};

export const ALL_DECK_IDS = Object.keys(DECKS) as DeckId[];
