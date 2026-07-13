import {
  Card,
  GameConfig,
  GameState,
  HAND_SIZES,
  PlayerInfo,
  Suit,
  TrickCard
} from './types.js';

export type Rng = () => number;

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ suit, rank, id: `${suit}${rank}` });
    }
  }
  return deck;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function newGame(config: GameConfig, players: PlayerInfo[]): GameState {
  if (config.seatCount < 2 || config.seatCount > 4) {
    throw new Error('Game supports 2-4 players');
  }
  if (players.length !== config.seatCount) {
    throw new Error('Player count must match seat count');
  }
  const n = config.seatCount;
  return {
    config,
    players,
    phase: 'lobby',
    handIndex: -1,
    handSize: 0,
    dealer: n - 1, // so the first hand's dealer is seat 0 after rotation
    trumpCard: null,
    hands: players.map(() => []),
    bids: players.map(() => null),
    tricksTaken: players.map(() => 0),
    scores: players.map(() => 0),
    turn: -1,
    trick: [],
    trickLeader: -1,
    trickWinner: null,
    lastTrick: null,
    history: []
  };
}

/** Deal the next hand: advance the hand counter, rotate dealer, shuffle, deal, flip trump. */
export function startNextHand(state: GameState, rng: Rng = Math.random): void {
  if (state.phase !== 'lobby' && state.phase !== 'handEnd') {
    throw new Error(`Cannot start a hand during ${state.phase}`);
  }
  const n = state.config.seatCount;
  state.handIndex += 1;
  if (state.handIndex >= HAND_SIZES.length) throw new Error('No hands remain');
  state.handSize = HAND_SIZES[state.handIndex];
  state.dealer = (state.dealer + 1) % n;

  const deck = shuffle(buildDeck(), rng);
  state.hands = [];
  for (let seat = 0; seat < n; seat++) {
    state.hands.push(deck.slice(seat * state.handSize, (seat + 1) * state.handSize));
  }
  state.trumpCard = deck[n * state.handSize];

  state.bids = state.players.map(() => null);
  state.tricksTaken = state.players.map(() => 0);
  state.trick = [];
  state.trickWinner = null;
  state.lastTrick = null;
  state.trickLeader = (state.dealer + 1) % n;
  state.turn = (state.dealer + 1) % n; // player left of dealer bids first, dealer last
  state.phase = 'bidding';
}

/** Hands after the 10-card peak (the 9..1 descent) — the hook rule only bites here. */
export function isBackHalf(handIndex: number): boolean {
  return handIndex >= 10;
}

export function legalBids(state: GameState, seat: number): number[] {
  if (state.phase !== 'bidding' || state.turn !== seat) return [];
  const all: number[] = [];
  for (let b = 0; b <= state.handSize; b++) all.push(b);
  // Hook rule: on the back half only, the dealer (last bidder) may not make
  // total bids equal the tricks available. 1 up to 10 is unrestricted.
  if (state.config.hookRule && seat === state.dealer && isBackHalf(state.handIndex)) {
    const otherTotal = state.bids.reduce<number>((sum, b) => sum + (b ?? 0), 0);
    return all.filter((b) => otherTotal + b !== state.handSize);
  }
  return all;
}

export function placeBid(state: GameState, seat: number, bid: number): void {
  if (state.phase !== 'bidding') throw new Error('Not in bidding phase');
  if (state.turn !== seat) throw new Error('Not your turn to bid');
  if (!legalBids(state, seat).includes(bid)) throw new Error('Illegal bid');
  state.bids[seat] = bid;

  const n = state.config.seatCount;
  if (seat === state.dealer) {
    // Dealer always bids last; bidding is done.
    state.phase = 'playing';
    state.turn = state.trickLeader;
  } else {
    state.turn = (seat + 1) % n;
  }
}

export function legalPlays(state: GameState, seat: number): Card[] {
  if (state.phase !== 'playing' || state.turn !== seat) return [];
  const hand = state.hands[seat];
  if (state.trick.length === 0) return hand.slice();
  const led = state.trick[0].card.suit;
  const following = hand.filter((c) => c.suit === led);
  return following.length > 0 ? following : hand.slice();
}

export function trickWinnerIndex(trick: TrickCard[], trump: Suit): number {
  const led = trick[0].card.suit;
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const card = trick[i].card;
    const bestCard = trick[best].card;
    const cardIsTrump = card.suit === trump;
    const bestIsTrump = bestCard.suit === trump;
    if (cardIsTrump && !bestIsTrump) {
      best = i;
    } else if (cardIsTrump === bestIsTrump) {
      const effective = cardIsTrump ? trump : led;
      if (card.suit === effective && bestCard.suit === effective && card.rank > bestCard.rank) {
        best = i;
      } else if (card.suit === effective && bestCard.suit !== effective) {
        best = i;
      }
    }
  }
  return trick[best].seat;
}

export function playCard(state: GameState, seat: number, cardId: string): void {
  if (state.phase !== 'playing') throw new Error('Not in playing phase');
  if (state.turn !== seat) throw new Error('Not your turn');
  const card = state.hands[seat].find((c) => c.id === cardId);
  if (!card) throw new Error('Card not in hand');
  if (!legalPlays(state, seat).some((c) => c.id === cardId)) {
    throw new Error('Must follow suit');
  }

  state.hands[seat] = state.hands[seat].filter((c) => c.id !== cardId);
  state.trick.push({ seat, card });

  const n = state.config.seatCount;
  if (state.trick.length === n) {
    // Trick complete: freeze the table until collectTrick() is called,
    // so everyone can see the final card before the trick is swept.
    state.trickWinner = trickWinnerIndex(state.trick, state.trumpCard!.suit);
    state.turn = -1;
  } else {
    state.turn = (seat + 1) % n;
  }
}

/** Sweep a completed trick off the table and either continue or score the hand. */
export function collectTrick(state: GameState): void {
  if (state.trickWinner === null) throw new Error('No completed trick to collect');
  const winner = state.trickWinner;
  state.tricksTaken[winner] += 1;
  state.lastTrick = { cards: state.trick, winner };
  state.trick = [];
  state.trickWinner = null;

  if (state.hands.every((h) => h.length === 0)) {
    scoreHand(state);
  } else {
    state.trickLeader = winner;
    state.turn = winner;
  }
}

function scoreHand(state: GameState): void {
  // Make your bid exactly: +(bid + 5). Miss it either way: -(bid + 5).
  const points = state.players.map((_, seat) => {
    const bid = state.bids[seat]!;
    const made = state.tricksTaken[seat] === bid;
    return made ? bid + 5 : -(bid + 5);
  });
  points.forEach((p, seat) => (state.scores[seat] += p));
  state.history.push({
    handIndex: state.handIndex,
    handSize: state.handSize,
    bids: state.bids.map((b) => b!),
    taken: state.tricksTaken.slice(),
    points,
    totals: state.scores.slice()
  });
  state.turn = -1;
  state.phase = state.handIndex === HAND_SIZES.length - 1 ? 'gameEnd' : 'handEnd';
}
