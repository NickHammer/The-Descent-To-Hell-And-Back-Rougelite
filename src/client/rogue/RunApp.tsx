/**
 * The Descent: single-player roguelite run. Entirely client-side — the run
 * lives in localStorage, hands are played by useLocalHand against ai.ts demons.
 */
import { useEffect, useMemo, useState } from 'react';
import { DEMONS } from '../../rogue/demons.js';
import { RELICS, RelicId } from '../../rogue/relics.js';
import {
  BOTTOM_INDEX,
  buildTrack,
  buyHeal,
  buyRelic,
  demonMaxHpFor,
  HEAL_COST,
  leaveShop,
  newRun,
  Region,
  resolveHand,
  RunState,
  STOP_COUNT,
  takeGift,
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
    const valid =
      typeof run.seed === 'number' &&
      typeof run.stopIndex === 'number' &&
      // pre-battle-system saves lack HP; those runs can't continue
      typeof run.hp === 'number' &&
      typeof run.demonHp === 'number';
    if (!valid) return null;
    run.lastHand ??= null;
    return run;
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
        resolve={(outcome) => resolveHand(run, track, outcome)}
        onContinue={(resolved) => {
          // Stay at the table while the battle is undecided; leave for the
          // map, shop, or reckoning once it is.
          const battleOn = resolved.phase === 'map' && resolved.stopIndex === run.stopIndex;
          if (!battleOn) setInHand(false);
          update(resolved);
        }}
        onQuit={() => {
          if (window.confirm('Abandon this run and return to the gate? All progress is lost.')) {
            setInHand(false);
            setRun(null);
          }
        }}
      />
    );
  } else if (run.phase === 'gift') {
    view = <GiftView run={run} onChange={update} onAbandon={() => setRun(null)} />;
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

  return (
    <div className={`rogue rogue-${region}`}>
      <Backdrop region={region} depth={run?.stopIndex ?? 0} />
      <div className="rogue-content">{view}</div>
    </div>
  );
}

/**
 * Ambient region effects: embers rise in hell (thicker and faster the deeper
 * you are), violet sparks sink into the void at the bottom, golden motes and
 * god-rays drift in heaven. Pure CSS animation — transform/opacity only.
 */
function Backdrop({ region, depth }: { region: Region; depth: number }) {
  const particles = useMemo(() => {
    const count = region === 'hell' ? 14 + depth * 3 : region === 'bottom' ? 30 : 20;
    const speedup = region === 'hell' ? Math.min(depth * 0.4, 3.5) : 0;
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: -Math.random() * 16,
      duration: (region === 'heaven' ? 16 : 9) + Math.random() * 8 - speedup,
      size: 2 + Math.random() * (region === 'heaven' ? 3 : 4),
      drift: (Math.random() - 0.5) * 140
    }));
  }, [region, depth]);

  return (
    <div className={`rogue-backdrop rogue-backdrop-${region}`} aria-hidden="true">
      {region === 'heaven' && <div className="rogue-rays" />}
      {region !== 'heaven' && <div className="rogue-glow-floor" />}
      {region === 'bottom' && <div className="rogue-voidpulse" />}
      {particles.map((p, i) => (
        <span
          key={i}
          className="rogue-particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`
          }}
        />
      ))}
    </div>
  );
}

function LazyHand({
  run,
  trackStop,
  resolve,
  onContinue,
  onQuit
}: {
  run: RunState;
  trackStop: ReturnType<typeof buildTrack>[number];
  resolve: (outcome: { bid: number; taken: number }) => RunState;
  onContinue: (resolved: RunState) => void;
  onQuit: () => void;
}) {
  return (
    <HandView
      key={`${run.stopIndex}-${run.attempts}`}
      stop={trackStop}
      relics={run.relics}
      hp={run.hp}
      maxHp={run.maxHp}
      demonHp={run.demonHp}
      demonMaxHp={demonMaxHpFor(trackStop)}
      grace={run.grace}
      souls={run.souls}
      playerName={localStorage.getItem('thab_name') ?? 'You'}
      seed={(run.seed ^ Math.imul(run.attempts + 1, 2654435761)) >>> 0}
      resolve={resolve}
      onContinue={onContinue}
      onQuit={onQuit}
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
          <li>
            Every gate holds a demon with <b>health</b>. Hands of Oh Hell repeat at its table —
            1 card at Circle 1, 10 at The Bottom — until one of you falls.
          </li>
          <li>
            <b>Make your bid exactly</b> and you strike for <b>5 + bid</b> damage (and earn souls).
            Miss and you take the blow instead. Bold bids cut deeper both ways.
          </li>
          <li>
            At 0 HP, <b>grace</b> catches you: −1 grace, back to full health, and the demon keeps
            its wounds. At 0 grace, the pit keeps you.
          </li>
          <li>
            On hands of <b>4+ cards</b> the trump stays <b>face-down while you bid</b> — the
            demons can see it. Small hands play fair. Relics help.
          </li>
          <li>Souls buy relics and grace at shops every third gate.</li>
          <li>Each demon warps one rule — it's shown before you play.</li>
          <li>You begin with a <b>gift</b>: one of three relics, yours to choose.</li>
        </ul>
        <button className="btn btn-primary" onClick={onStart}>
          🔥 Begin the descent
        </button>
      </div>
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
  const demonMaxHp = demonMaxHpFor(stop);
  const wounded = run.demonHp < demonMaxHp;
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
        <p className="rogue-flavor">
          💀 {run.demonHp}/{demonMaxHp} HP{wounded && ' — it bleeds'}
        </p>
        {stop.demonId !== 'imp' && <p className="rogue-quirk">⚠ {demon.quirk}</p>}
        <button className="btn btn-primary" onClick={onPlay}>
          {wounded
            ? 'Fight on — the wounds hold'
            : `${stop.region === 'heaven' ? 'Ascend' : 'Descend'} — join battle`}
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

function GiftView({
  run,
  onChange,
  onAbandon
}: {
  run: RunState;
  onChange: (r: RunState) => void;
  onAbandon: () => void;
}) {
  return (
    <div className="home rogue-gift">
      <h1 className="title">A Gift at the Gate</h1>
      <p className="subtitle">
        Someone — something — left these for you. Take one. The road below is blind and hungry.
      </p>
      <div className="panel">
        {run.shopOffers.map((id) => {
          const r = RELICS[id];
          return (
            <div key={id} className="rogue-offer">
              <div>
                <b>{r.name}</b> <span className="muted">({r.tier})</span>
                <div className="rogue-flavor">{r.effect}</div>
              </div>
              <button className="btn btn-primary" onClick={() => onChange(takeGift(run, id))}>
                Take
              </button>
            </div>
          );
        })}
      </div>
      <button className="btn rogue-abandon" onClick={onAbandon}>
        Turn back from the gate
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
      <span className="rogue-hud">❤ {run.hp}/{run.maxHp} hp</span>
      <span className="rogue-hud">🕊 {run.grace}/{run.maxGrace} grace</span>
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
