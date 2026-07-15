import { useState } from 'react';
import { Leaderboard } from './Leaderboard.js';

export function Home({
  initialName,
  joinCode,
  onCreate,
  onJoin
}: {
  initialName: string;
  /** pre-filled from a /join/CODE QR link */
  joinCode: string | null;
  onCreate: (
    name: string,
    seatCount: number,
    maxHandSize: number,
    hookRule: boolean,
    takeSeat: boolean
  ) => void;
  onJoin: (name: string, code: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [seatCount, setSeatCount] = useState(2);
  const [maxHandSize, setMaxHandSize] = useState(10);
  const [hookRule, setHookRule] = useState(true);
  const [takeSeat, setTakeSeat] = useState(true);
  const [code, setCode] = useState(joinCode ?? '');
  const [showBoard, setShowBoard] = useState(false);

  const trimmed = name.trim();

  return (
    <div className="home">
      <h1 className="title">To Hell and Back</h1>
      <p className="subtitle">
        An online version of the classic Oh Hell card game. Bid your tricks. Take exactly that
        many. 1 up to 10 and back again.
      </p>

      <label className="field">
        Your name
        <input
          value={name}
          maxLength={20}
          placeholder="e.g. Nick"
          onChange={(e) => setName(e.target.value)}
          autoFocus={!joinCode || !initialName}
        />
      </label>

      <a className="btn btn-primary rogue-entry" href="/run">
        🔥 The Descent — solo roguelite (prototype)
      </a>

      {joinCode ? (
        <div className="panel">
          <h2>Join game {joinCode}</h2>
          <button className="btn btn-primary" disabled={!trimmed} onClick={() => onJoin(trimmed, joinCode)}>
            Take a seat
          </button>
        </div>
      ) : (
        <>
          <div className="panel">
            <h2>New game</h2>
            <label className="field">
              Players
              <div className="seg">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    className={`seg-btn ${seatCount === n ? 'seg-on' : ''}`}
                    onClick={() => setSeatCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              Game length — hands go 1 up to this and back down ({maxHandSize * 2 - 1} hands)
              <div className="seg">
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    className={`seg-btn ${maxHandSize === n ? 'seg-on' : ''}`}
                    onClick={() => setMaxHandSize(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>
            <label className="check">
              <input type="checkbox" checked={hookRule} onChange={(e) => setHookRule(e.target.checked)} />
              Hook rule — on the back half (the descent back to 1), the dealer can't make total
              bids equal the tricks
            </label>
            <label className="check">
              <input type="checkbox" checked={takeSeat} onChange={(e) => setTakeSeat(e.target.checked)} />
              I'm playing on this device
              <span className="hint">(uncheck to use this screen as a shared table display)</span>
            </label>
            <button
              className="btn btn-primary"
              disabled={takeSeat && !trimmed}
              onClick={() => onCreate(trimmed || 'Host', seatCount, maxHandSize, hookRule, takeSeat)}
            >
              Create game
            </button>
          </div>

          <div className="panel">
            <h2>Join a game</h2>
            <div className="join-row">
              <input
                value={code}
                placeholder="CODE"
                maxLength={4}
                className="code-input"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button
                className="btn"
                disabled={!trimmed || code.trim().length !== 4}
                onClick={() => onJoin(trimmed, code.trim())}
              >
                Join
              </button>
            </div>
          </div>

          <button className="btn board-btn" onClick={() => setShowBoard(true)}>
            🏆 Leaderboard
          </button>
        </>
      )}

      <footer className="page-footer">
        <a href="/rules">How to play Oh Hell &amp; strategy</a>
        <span aria-hidden="true"> · </span>
        <a href="/privacy">Privacy</a>
      </footer>

      {showBoard && <Leaderboard onClose={() => setShowBoard(false)} />}
    </div>
  );
}
