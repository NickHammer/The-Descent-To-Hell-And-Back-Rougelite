/**
 * Headless smoke test: bots play many full games; prints stats.
 * Run with: npm run sim
 */
import { chooseBid, chooseCard } from './ai.js';
import { collectTrick, newGame, placeBid, playCard, startNextHand } from './engine.js';
import { GameState, PlayerInfo } from './types.js';

function playFullGame(seatCount: number): GameState {
  const players: PlayerInfo[] = Array.from({ length: seatCount }, (_, i) => ({
    name: `Bot ${i + 1}`,
    isBot: true,
    connected: true
  }));
  const state = newGame({ seatCount, maxHandSize: 10, hookRule: true }, players);
  while (state.phase !== 'gameEnd') {
    startNextHand(state);
    while (state.phase === 'bidding') {
      placeBid(state, state.turn, chooseBid(state, state.turn));
    }
    while (state.phase === 'playing') {
      while (state.trickWinner === null) {
        playCard(state, state.turn, chooseCard(state, state.turn).id);
      }
      collectTrick(state);
    }
  }
  return state;
}

const GAMES = 200;
for (const seats of [2, 3, 4]) {
  let madeBids = 0;
  let totalBids = 0;
  let bestScore = -1;
  for (let g = 0; g < GAMES; g++) {
    const state = playFullGame(seats);
    for (const hand of state.history) {
      hand.bids.forEach((bid, seat) => {
        totalBids++;
        if (bid === hand.taken[seat]) madeBids++;
      });
    }
    bestScore = Math.max(bestScore, ...state.scores);
  }
  const pct = ((madeBids / totalBids) * 100).toFixed(1);
  console.log(`${seats} players: ${GAMES} games OK — bots made their bid ${pct}% of the time, best score ${bestScore}`);
}
console.log('Simulation complete: no rule violations thrown.');
