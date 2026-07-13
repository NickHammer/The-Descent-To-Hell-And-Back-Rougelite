import { Card, GameConfig, HandResult, Phase, TrickCard } from '../shared/types.js';

export interface SeatInfo {
  name: string;
  isBot: boolean;
  connected: boolean;
}

export interface PlayerView extends SeatInfo {
  bid: number | null;
  tricksTaken: number;
  score: number;
  cardsLeft: number;
}

export interface StateMsg {
  type: 'state';
  roomCode: string;
  seat: number | null;
  isHost: boolean;
  config: GameConfig;
  seats: (SeatInfo | null)[];
  phase: Phase;
  handIndex?: number;
  handNumber?: number;
  handCount?: number;
  handSize?: number;
  dealer?: number;
  trumpCard?: Card | null;
  players?: PlayerView[];
  turn?: number;
  trick?: TrickCard[];
  trickWinner?: number | null;
  lastTrick?: { cards: TrickCard[]; winner: number } | null;
  history?: HandResult[];
  hand?: Card[] | null;
  legalBids?: number[];
  legalPlays?: string[];
}

export interface JoinedMsg {
  type: 'joined';
  roomCode: string;
  token: string;
}

export interface ErrorMsg {
  type: 'error';
  message: string;
}

export type ServerMsg = StateMsg | JoinedMsg | ErrorMsg;
