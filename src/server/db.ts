import pg from 'pg';
import { GameState } from '../shared/types.js';

const url = process.env.DATABASE_URL;

/** Leaderboard is optional: without DATABASE_URL the game runs fine, just unranked. */
export const dbEnabled = Boolean(url);

const pool = url
  ? new pg.Pool({
      connectionString: url,
      max: 3,
      // Neon (and most hosted Postgres) require TLS; local dev DBs don't have certs.
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false }
    })
  : null;

export async function initDb(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_results (
      id BIGSERIAL PRIMARY KEY,
      finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      room_code TEXT NOT NULL,
      seat_count INT NOT NULL,
      player_name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      score INT NOT NULL,
      placement INT NOT NULL,
      won BOOLEAN NOT NULL,
      hands_bid_made INT NOT NULL,
      hands_played INT NOT NULL
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_game_results_time ON game_results (finished_at)'
  );
  console.log('Leaderboard database ready');
}

function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Record one finished, human-only game: one row per player. */
export async function recordGame(roomCode: string, state: GameState): Promise<void> {
  if (!pool) return;
  const values: unknown[] = [];
  const tuples: string[] = [];
  state.players.forEach((p, seat) => {
    const score = state.scores[seat];
    const placement = 1 + state.scores.filter((s) => s > score).length;
    const made = state.history.filter((h) => h.bids[seat] === h.taken[seat]).length;
    const base = values.length;
    tuples.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
    );
    values.push(
      roomCode,
      state.config.seatCount,
      p.name,
      nameKey(p.name),
      score,
      placement,
      placement === 1,
      made,
      state.history.length
    );
  });
  await pool.query(
    `INSERT INTO game_results
       (room_code, seat_count, player_name, name_key, score, placement, won, hands_bid_made, hands_played)
     VALUES ${tuples.join(', ')}`,
    values
  );
}

export interface LeaderboardRow {
  name: string;
  games: number;
  wins: number;
  total: number;
  best: number;
  made: number;
  hands: number;
}

/** Aggregate standings; windowDays null = all time. */
export async function getLeaderboard(windowDays: number | null): Promise<LeaderboardRow[]> {
  if (!pool) return [];
  const where = windowDays ? `WHERE finished_at > now() - make_interval(days => $1)` : '';
  const params = windowDays ? [windowDays] : [];
  const result = await pool.query(
    `SELECT
       (array_agg(player_name ORDER BY finished_at DESC))[1] AS name,
       COUNT(*)::int AS games,
       COALESCE(SUM(CASE WHEN won THEN 1 ELSE 0 END), 0)::int AS wins,
       COALESCE(SUM(score), 0)::int AS total,
       COALESCE(MAX(score), 0)::int AS best,
       COALESCE(SUM(hands_bid_made), 0)::int AS made,
       COALESCE(SUM(hands_played), 0)::int AS hands
     FROM game_results
     ${where}
     GROUP BY name_key
     ORDER BY wins DESC, total DESC
     LIMIT 50`,
    params
  );
  return result.rows;
}
