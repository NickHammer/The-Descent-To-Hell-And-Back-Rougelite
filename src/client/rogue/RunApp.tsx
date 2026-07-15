/**
 * The Descent: single-player roguelite run. Entirely client-side — the run
 * lives in localStorage, hands are played by useLocalHand against ai.ts demons.
 */
import { useEffect, useState } from 'react';
import { DEMONS } from '../../rogue/demons.js';
import { RELICS, RelicId } from '../../rogue/relics.js';
import {
  BOTTOM_INDEX,
  buildTrack,
  buyHeal,
  buyRelic,
  HEAL_COST,
  leaveShop,
  newRun,
  resolveHand,
  RunState,
  STOP_COUNT,
  useFerrymansCoin
} from '../../rogue/run.js';
import { play as playSound } from '../sounds.js';
import { HandView } from './HandView.js';

const SAVE_KEY = 'thab_rogue_run';

function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    return typeof run.seed === 'number' && typeof run.stopIndex === 'number' ? run : null;
  } catch {
    return null;
  }
}

export function RunApp() {
  const [run, setRun] = useState<RunState | null>(loadRun);
  const [inHand, setInHand] = useState(false);

  useEffect(() => {
    if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run));
    else localStorage.removeItem(SAVE_KEY);
  }, [run]);

  const track = run ? buildTrack(run.seed) : null;
  const region = run && track ? track[Math.min(run.stopIndex, STOP_COUNT - 1)].region : 'hell';

  const update = (next: RunState) => {
    if (next.phase === 'won' && run?.phase !== 'won') playSound('win');
    setRun(next);
  };

  let view: JSX.Element;
  if (!run || !track) {
    view = <StartView onStart={() => setRun(newRun())} />;
  } else if (inHand && run.phase === 'map') {
    view = (
      <LazyHand
        run={run}
        trackStop={track[run.stopIndex]}
        onDone={(outcome) => {
          setInHand(false);
          update(resolveHand(run, track, outcome));
        }}
      />
    );
  } else if (run.phase === 'shop') {
    view = <ShopView run={run} onChange={update} />;
  } else if (run.phase === 'dead' || run.phase === 'won') {
    view = <EndView run={run} onNewRun={() => setRun(newRun())} />;
  } else {
    view = (
      <MapView
        run={run}
        onPlay={() => setInHand(true)}
        onFerryman={() => update(useFerrymansCoin(run, track))}
        onAbandon={() => setRun(null)}
      />
    );
  }

  return <div className={`rogue rogue-${region}`}>{view}</div>;
}

function LazyHand({
  run,
  trackStop,
  onDone
}: {
  run: RunState;
  trackStop: ReturnType<typeof buildTrack>[number];
  onDone: (outcome: { bid: number; taken: number }) => void;
}) {
  return (
    <HandView
      key={`${run.stopIndex}-${run.attempts}`}
      stop={trackStop}
      relics={run.relics}
      grace={run.grace}
      souls={run.souls}
      playerName={localStorage.getItem('thab_name') ?? 'You'}
      seed={(run.seed ^ Math.imul(run.attempts + 1, 2654435761)) >>> 0}
      onDone={onDone}
    />
  );
}

function StartView({ onStart }: { onStart: () => void }) {
  return (
    <div className="home rogue-start">
      <h1 className="title">The Descent</h1>
      <p className="subtitle">
        You died. Nine circles down, nine spheres up — one hand of cards at every gate.
        Bid exactly what you take, or the pit takes you.
      </p>
      <div className="panel">
        <h2>The rules of the pit</h2>
        <ul className="rogue-ruleslist">
          <li>One hand per stop: 1 card at Circle 1, 10 at The Bottom, back to 1 at the last sphere.</li>
          <li>Make your bid exactly to pass. Miss and you lose <b>grace</b> — at 0, the run ends.</li>
          <li>The trump card stays <b>face-down while you bid</b>. The demons can see it. Relics help.</li>
          <li>Made bids earn <b>souls</b>; shops every third gate sell relics and grace.</li>
          <li>Each table's demon warps one rule — it's shown before you play.</li>
        </ul>
        <button className="btn btn-primary" onClick={onStart}>
          🔥 Begin the descent
        </button>
      </div>
      <footer className="page-footer">
        <a href="/">the multiplayer table</a>
      </footer>
    </div>
  );
}

function MapView({
  run,
  onPlay,
  onFerryman,
  onAbandon
}: {
  run: RunState;
  onPlay: () => void;
  onFerryman: () => void;
  onAbandon: () => void;
}) {
  const track = buildTrack(run.seed);
  const stop = track[run.stopIndex];
  const demon = DEMONS[stop.demonId];
  const canFerry = run.relics.includes('ferrymansCoin') && stop.region !== 'bottom';

  return (
    <div className="home rogue-map">
      <h1 className="title">
        {stop.region === 'hell' ? 'The Descent' : stop.region === 'bottom' ? 'The Bottom' : 'The Ascent'}
      </h1>
      <Hud run={run} />

      <div className="panel">
        <h2>
          {stop.label} · {stop.handSize} card{stop.handSize === 1 ? '' : 's'} · vs {stop.demonCount}{' '}
          demons
        </h2>
        <p className="rogue-flavor">
          <b>{demon.name}.</b> {demon.flavor}
        </p>
        {stop.demonId !== 'imp' && <p className="rogue-quirk">⚠ {demon.quirk}</p>}
        <button className="btn btn-primary" onClick={onPlay}>
          {stop.region === 'heaven' ? 'Ascend' : 'Descend'} — play the hand
        </button>
        {canFerry && (
          <button className="btn" onClick={onFerryman}>
            🪙 Use the Ferryman's Coin — skip {stop.label}
          </button>
        )}
      </div>

      <div className="panel">
        <h2>The road</h2>
        <ol className="rogue-track">
          {track.map((s) => (
            <li
              key={s.index}
              className={
                s.index < run.stopIndex
                  ? 'rogue-stop-cleared'
                  : s.index === run.stopIndex
                    ? 'rogue-stop-current'
                    : 'rogue-stop-future'
              }
            >
              {s.region === 'bottom' ? '💀' : s.region === 'hell' ? '🔥' : '☁️'} {s.label} ·{' '}
              {s.handSize}
              {s.index === run.stopIndex && <b> ← you</b>}
              {s.shopAfter && <span className="muted"> · 🕯 shop after</span>}
            </li>
          ))}
        </ol>
      </div>

      {run.relics.length > 0 && <RelicTray relics={run.relics} />}

      <button className="btn rogue-abandon" onClick={onAbandon}>
        Abandon run
      </button>
    </div>
  );
}

function ShopView({ run, onChange }: { run: RunState; onChange: (r: RunState) => void }) {
  return (
    <div className="home rogue-shop">
      <h1 className="title">🕯 The Shop Between</h1>
      <p className="subtitle">The keeper doesn't ask how you died. Souls only.</p>
      <Hud run={run} />

      <div className="panel">
        {run.shopOffers.map((id) => {
          const r = RELICS[id];
          return (
            <div key={id} className="rogue-offer">
              <div>
                <b>{r.name}</b> <span className="muted">({r.tier})</span>
                <div className="rogue-flavor">{r.effect}</div>
              </div>
              <button
                className="btn"
                disabled={run.souls < r.cost}
                onClick={() => onChange(buyRelic(run, id))}
              >
                ✦ {r.cost}
              </button>
            </div>
          );
        })}
        {run.shopOffers.length === 0 && <p className="muted">Sold out.</p>}
        <div className="rogue-offer">
          <div>
            <b>Restore 1 grace</b>
            <div className="rogue-flavor">A candle relit.</div>
          </div>
          <button
            className="btn"
            disabled={run.souls < HEAL_COST || run.grace >= run.maxGrace}
            onClick={() => onChange(buyHeal(run))}
          >
            ✦ {HEAL_COST}
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => onChange(leaveShop(run))}>
          Back to the road
        </button>
      </div>

      {run.relics.length > 0 && <RelicTray relics={run.relics} />}
    </div>
  );
}

function EndView({ run, onNewRun }: { run: RunState; onNewRun: () => void }) {
  const won = run.phase === 'won';
  const cleared = won ? STOP_COUNT : run.stopIndex;
  return (
    <div className="home rogue-end">
      <h1 className="title">{won ? '☀ Paradise' : '💀 The Pit Keeps You'}</h1>
      <p className="subtitle">
        {won
          ? 'Down through nine circles and back up through nine spheres. To hell and back, literally.'
          : `You made it ${cleared > BOTTOM_INDEX ? 'past the bottom' : `to ${buildTrack(run.seed)[run.stopIndex].label}`} before your grace ran out.`}
      </p>
      <div className="panel">
        <h2>The reckoning</h2>
        <ul className="rogue-ruleslist">
          <li>Stops cleared: {cleared} of {STOP_COUNT}</li>
          <li>Hands played: {run.attempts}</li>
          <li>Souls in hand: {run.souls}</li>
          <li>Relics: {run.relics.length ? run.relics.map((r) => RELICS[r].name).join(', ') : 'none'}</li>
        </ul>
        <button className="btn btn-primary" onClick={onNewRun}>
          {won ? 'Descend again' : 'Try again'}
        </button>
      </div>
      <div className="panel">
        <h2>The tale</h2>
        <ul className="rogue-log">
          {run.log.slice(-12).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Hud({ run }: { run: RunState }) {
  return (
    <div className="rogue-hudbar">
      <span className="rogue-hud">❤ {run.grace}/{run.maxGrace} grace</span>
      <span className="rogue-hud">✦ {run.souls} souls</span>
      <span className="rogue-hud">
        gate {Math.min(run.stopIndex + 1, STOP_COUNT)}/{STOP_COUNT}
      </span>
    </div>
  );
}

function RelicTray({ relics }: { relics: RelicId[] }) {
  return (
    <div className="panel">
      <h2>Relics</h2>
      {relics.map((id, i) => (
        <div key={`${id}-${i}`} className="rogue-flavor">
          <b>{RELICS[id].name}</b> — {RELICS[id].effect}
        </div>
      ))}
    </div>
  );
}
