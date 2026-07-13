export type Suit = 'S' | 'H' | 'D' | 'C';

/** rank: 2-10 as face value, 11=J, 12=Q, 13=K, 14=A */
export interface Card {
  suit: Suit;
  rank: number;
  id: string;
}

export type Phase = 'lobby' | 'bidding' | 'playing' | 'handEnd' | 'gameEnd';

export interface GameConfig {
  seatCount: number; // 2-4
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
  handIndex: number; // 0..18
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
  history: HandResult[];
}

/** The hand sizes for the 19 hands: 1..10..1 */
export const HAND_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export const SUIT_NAMES: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs'
};

export const SUIT_GLYPHS: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣'
};

export function rankLabel(rank: number): string {
  if (rank <= 10) return String(rank);
  return { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[rank]!;
}
