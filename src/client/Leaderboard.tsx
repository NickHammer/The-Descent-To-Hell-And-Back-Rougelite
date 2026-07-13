import { useEffect, useState } from 'react';

interface Row {
  name: string;
  games: number;
  wins: number;
  total: number;
  best: number;
  made: number;
  hands: number;
}

interface BoardData {
  enabled: boolean;
  error?: string;
  rows: Row[];
}

export function Leaderboard({ onClose }: { onClose: () => void }) {
  const [window, setWindow] = useState<'30' | 'all'>('30');
  const [data, setData] = useState<BoardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/leaderboard?window=${window === 'all' ? 'all' : '30'}`)
      .then((r) => r.json())
      .then((d: BoardData) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ enabled: true, error: 'Could not load', rows: [] }));
    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>🏆 Leaderboard</h2>
        <div className="seg board-toggle">
          <button className={`seg-btn ${window === '30' ? 'seg-on' : ''}`} onClick={() => setWindow('30')}>
            Last 30 days
          </button>
          <button className={`seg-btn ${window === 'all' ? 'seg-on' : ''}`} onClick={() => setWindow('all')}>
            All time
          </button>
        </div>

        {!data && <p className="muted">Loading…</p>}
        {data && !data.enabled && (
          <p className="muted">No leaderboard on this server (it isn't connected to a database).</p>
        )}
        {data && data.enabled && data.error && <p className="muted">{data.error}</p>}
        {data && data.enabled && !data.error && data.rows.length === 0 && (
          <p className="muted">
            No ranked games yet — finish a game with no bots at the table to get on the board.
          </p>
        )}
        {data && data.rows.length > 0 && (
          <div className="score-scroll">
            <table className="score-table score-history">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Wins</th>
                  <th>Games</th>
                  <th>Bids made</th>
                  <th>Points</th>
                  <th>Best</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.name}>
                    <td>{i + 1}</td>
                    <td className="board-name">{r.name}</td>
                    <td>
                      <b>{r.wins}</b>{' '}
                      <span className="hist-total">{Math.round((r.wins / r.games) * 100)}%</span>
                    </td>
                    <td>{r.games}</td>
                    <td>{r.hands > 0 ? Math.round((r.made / r.hands) * 100) : 0}%</td>
                    <td>{r.total}</td>
                    <td>{r.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="hint">Human-only games count. Ranked by wins, then total points.</div>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
