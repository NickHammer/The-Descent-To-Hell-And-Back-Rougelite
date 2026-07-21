export type Suit = 'S' | 'H' | 'D' | 'C';

/** rank: 2-10 as face value, 11=J, 12=Q, 13=K, 14=A */
export interface Card {
  suit: Suit;
  rank: number;
  id: string;
  /** roguelite card enchantment id, if any (opaque here — see rogue/scoring.ts) */
  enchant?: string;
}

export type Phase = 'lobby' | 'bidding' | 'playing' | 'handEnd' | 'gameEnd';

export interface GameConfig {
  seatCount: number; // 2-4
  maxHandSize: number; // peak hand size: hands run 1 up to this and back down (3-10)
  hookRule: boolean; // dealer may not bid so that total bids === hand size
}

export interface PlayerInfo {
  name: string;
  isBot: boolean;
  connected: boolean;
}

export interface TrickCard {
  seat: number;
  card: Card;
}

/** A collected trick, kept for the whole hand (lastTrick only holds the newest). */
export interface TrickRecord {
  cards: TrickCard[];
  winner: number;
  /** trump suit in force when the trick was collected (quirks can shift it mid-hand) */
  trumpSuit: Suit;
}

export interface HandResult {
  handIndex: number;
  handSize: number;
  bids: number[];
  taken: number[];
  points: number[]; // points earned this hand
  totals: number[]; // cumulative scores after this hand
}

export interface GameState {
  config: GameConfig;
  players: PlayerInfo[];
  phase: Phase;
  handIndex: number; // 0 .. 2*maxHandSize-2
  handSize: number;
  dealer: number;
  trumpCard: Card | null;
  hands: Card[][]; // private! never sent to other players
  bids: (number | null)[];
  tricksTaken: number[];
  scores: number[];
  /** whose turn to bid/play; -1 while a completed trick sits on the table */
  turn: number;
  trick: TrickCard[];
  trickLeader: number;
  /** set when the current trick is complete and awaiting collection */
  trickWinner: number | null;
  lastTrick: { cards: TrickCard[]; winner: number } | null;
  /** every trick collected this hand, in order */
  trickLog: TrickRecord[];
  history: HandResult[];
}

/** The hand sizes for a game peaking at `peak` cards: 1..peak..1 (2*peak - 1 hands). */
export function handSizes(peak: number): number[] {
  const up = Array.from({ length: peak }, (_, i) => i + 1);
  return up.concat(up.slice(0, -1).reverse());
}

export const SUIT_NAMES: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs'
};

// U+FE0E forces text presentation so suits render as crisp font glyphs, not emoji.
export const SUIT_GLYPHS: Record<Suit, string> = {
  S: '♠︎',
  H: '♥︎',
  D: '♦︎',
  C: '♣︎'
};

export function rankLabel(rank: number): string {
  if (rank <= 10) return String(rank);
  return { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[rank]!;
}
