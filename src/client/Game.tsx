import { useEffect, useRef, useState } from 'react';
import { SUIT_GLYPHS, SUIT_NAMES } from '../shared/types.js';
import { CardView, PlayerBadge } from './components.js';
import { isMuted, play, setMuted } from './sounds.js';
import { StateMsg } from './view.js';

/** How long the winning card stays highlighted before the trick flies to the winner.
 *  Must finish (plus the 0.5s sweep animation) before the server's TRICK_PAUSE_MS collect. */
const SWEEP_DELAY_MS = 3300;

export function Game({
  state,
  send,
  onLeave
}: {
  state: StateMsg;
  send: (msg: object) => void;
  onLeave: () => void;
}) {
  const [showScores, setShowScores] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const stripRef = useRef<HTMLDivElement>(null);
  const trickRef = useRef<HTMLDivElement>(null);
  const [sweep, setSweep] = useState<{ x: number; y: number } | null>(null);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  // When a trick completes, pause on the winner highlight, then sweep the
  // cards toward the winner's badge (measured from the live layout).
  const trickWinner = state.trickWinner ?? null;
  useEffect(() => {
    if (trickWinner === null) {
      setSweep(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const badge = stripRef.current?.children[trickWinner];
      const area = trickRef.current;
      if (badge && area) {
        const b = badge.getBoundingClientRect();
        const a = area.getBoundingClientRect();
        setSweep({
          x: b.left + b.width / 2 - (a.left + a.width / 2),
          y: b.top + b.height / 2 - (a.top + a.height / 2)
        });
      } else {
        setSweep({ x: 0, y: -240 });
      }
    }, SWEEP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [trickWinner]);
  const players = state.players!;
  const trump = state.trumpCard!;
  const seat = state.seat;
  const myTurn = seat !== null && state.turn === seat;
  const bidding = state.phase === 'bidding';
  const turnName = state.turn != null && state.turn >= 0 ? players[state.turn].name : null;

  // Sound effects: diff successive states to spot what just happened.
  const sndPrev = useRef<{
    handIndex: number;
    trickLen: number;
    trickWinner: number | null;
    myTurn: boolean;
    phase: string;
  } | null>(null);
  useEffect(() => {
    const cur = {
      handIndex: state.handIndex ?? -1,
      trickLen: state.trick?.length ?? 0,
      trickWinner,
      myTurn,
      phase: state.phase
    };
    const prev = sndPrev.current;
    sndPrev.current = cur;
    if (!prev) return;
    if (cur.phase === 'gameEnd' && prev.phase !== 'gameEnd') play('win');
    else if (cur.trickWinner !== null && prev.trickWinner === null) play('trick');
    else if (cur.handIndex !== prev.handIndex) play('deal');
    else if (cur.trickLen > prev.trickLen) play('card');
    if (cur.myTurn && !prev.myTurn && cur.trickWinner === null) play('turn');
  });

  return (
    <div className="game">
      <header className="topbar">
        <div className="hand-info">
          <b>Hand {state.handNumber} of {state.handCount}</b> · {state.handSize} card
          {state.handSize === 1 ? '' : 's'}
        </div>
        <div className={`trump-info trump-${trump.suit}`}>
          Trump: <CardView card={trump} size="md" />
          <span className="trump-name">{SUIT_NAMES[trump.suit]}</span>
        </div>
        <div className="topbar-right">
          <button
            className="btn btn-small"
            onClick={toggleMute}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="btn btn-small" onClick={() => setShowScores(true)}>
            Scores
          </button>
          <span className="room-tag">{state.roomCode}</span>
        </div>
      </header>

      <div className="players-strip" ref={stripRef}>
        {players.map((p, i) => (
          <PlayerBadge
            key={i}
            player={p}
            isDealer={i === state.dealer}
            isTurn={i === state.turn}
            isYou={i === seat}
            bidding={bidding}
          />
        ))}
      </div>

      <div className="table-felt">
        {state.trick!.length === 0 && state.trickWinner == null ? (
          <div className="table-hintline">
            {bidding
              ? myTurn
                ? 'Your bid!'
                : `Waiting for ${turnName} to bid…`
              : myTurn
                ? 'Your lead.'
                : turnName
                  ? `${turnName} leads…`
                  : ''}
          </div>
        ) : (
          <div
            className={`trick-area ${sweep ? 'trick-sweeping' : ''}`}
            ref={trickRef}
            style={
              sweep
                ? ({ '--sweep-x': `${sweep.x}px`, '--sweep-y': `${sweep.y}px` } as React.CSSProperties)
                : undefined
            }
          >
            {state.trick!.map((tc, i) => (
              <div
                key={tc.card.id}
                className={`trick-card ${state.trickWinner === tc.seat ? 'trick-winner' : ''}`}
              >
                <CardView card={tc.card} size="lg" />
                <div className="trick-name">
                  {players[tc.seat].name}
                  {i === 0 && <span className="led-chip">led</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {state.trickWinner != null && (
          <div className="winner-banner">{players[state.trickWinner].name} takes the trick</div>
        )}
        {state.trickWinner == null && state.trick!.length > 0 && !myTurn && turnName && (
          <div className="table-hintline small">waiting for {turnName}…</div>
        )}
      </div>

      {seat !== null && state.hand && (
        <div className="my-area">
          {bidding && myTurn && (
            <div className="bid-picker">
              <div className="bid-label">How many tricks will you take?</div>
              <div className="bid-buttons">
                {Array.from({ length: state.handSize! + 1 }, (_, b) => {
                  const legal = state.legalBids!.includes(b);
                  return (
                    <button
                      key={b}
                      className="btn bid-btn"
                      disabled={!legal}
                      onClick={() => send({ type: 'bid', bid: b })}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
              {state.legalBids!.length < state.handSize! + 1 && (
                <div className="bid-hint">
                  {Array.from({ length: state.handSize! + 1 }, (_, b) => b)
                    .filter((b) => !state.legalBids!.includes(b))
                    .join(', ')}{' '}
                  is blocked — hook rule: on the back half, the dealer can't make total bids
                  equal {state.handSize}
                </div>
              )}
            </div>
          )}
          <div className="hand-fan">
            {state.hand.map((card, i) => {
              const playable =
                state.phase === 'playing' && myTurn && state.legalPlays!.includes(card.id);
              return (
                <CardView
                  key={card.id}
                  card={card}
                  size="lg"
                  disabled={state.phase === 'playing' && myTurn && !playable}
                  onClick={playable ? () => send({ type: 'play', cardId: card.id }) : undefined}
                  style={{ animationDelay: `${i * 45}ms` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {seat === null && (
        <div className="spectator-note">
          Table display — players see their own cards on their phones ({SUIT_GLYPHS[trump.suit]}{' '}
          {SUIT_NAMES[trump.suit].toLowerCase()} are trump)
        </div>
      )}

      {(state.phase === 'handEnd' || state.phase === 'gameEnd') && (
        <HandSummary state={state} send={send} onLeave={onLeave} />
      )}

      {showScores && <ScoreHistory state={state} onClose={() => setShowScores(false)} />}
    </div>
  );
}

function ScoreHistory({ state, onClose }: { state: StateMsg; onClose: () => void }) {
  const players = state.players!;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Scoreboard</h2>
        <div className="score-scroll">
          <table className="score-table score-history">
            <thead>
              <tr>
                <th>Hand</th>
                {players.map((p, i) => (
                  <th key={i}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.history!.length === 0 && (
                <tr>
                  <td colSpan={players.length + 1} className="muted">
                    No hands finished yet
                  </td>
                </tr>
              )}
              {state.history!.map((h) => (
                <tr key={h.handIndex}>
                  <td>
                    {h.handIndex + 1} <span className="muted">({h.handSize})</span>
                  </td>
                  {players.map((_, s) => (
                    <td key={s} className={h.bids[s] === h.taken[s] ? 'made-bid' : 'missed-bid'}>
                      {h.taken[s]}/{h.bids[s]} <span className="hist-total">{h.totals[s]}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {players.map((p, i) => (
                  <td key={i}>
                    <b>{p.score}</b>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="hint">taken/bid per hand — green means the bid was made</div>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function HandSummary({
  state,
  send,
  onLeave
}: {
  state: StateMsg;
  send: (msg: object) => void;
  onLeave: () => void;
}) {
  const players = state.players!;
  const last = state.history![state.history!.length - 1];
  const gameOver = state.phase === 'gameEnd';
  const standings = players
    .map((p, i) => ({ name: p.name, score: p.score, seat: i }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{gameOver ? '🏁 Final scores' : `Hand ${last.handIndex + 1} complete`}</h2>
        {gameOver && (
          <p className="winner-line">
            🏆 <b>{standings[0].name}</b> wins with {standings[0].score} points!
          </p>
        )}
        <table className="score-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Bid</th>
              <th>Took</th>
              <th>Points</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={i} className={i === state.seat ? 'row-you' : ''}>
                <td>{p.name}</td>
                <td>{last.bids[i]}</td>
                <td>{last.taken[i]}</td>
                <td className={last.bids[i] === last.taken[i] ? 'made-bid' : 'missed-bid'}>
                  {last.bids[i] === last.taken[i] ? `+${last.points[i]} ✓` : `${last.points[i]}`}
                </td>
                <td>
                  <b>{last.totals[i]}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!gameOver &&
          (state.isHost ? (
            <button className="btn btn-primary" onClick={() => send({ type: 'continue' })}>
              Deal hand {last.handIndex + 2}
            </button>
          ) : (
            <p className="muted">Waiting for the host to deal the next hand…</p>
          ))}
        {gameOver && (
          <button className="btn btn-primary" onClick={onLeave}>
            Back to home
          </button>
        )}
      </div>
    </div>
  );
}
