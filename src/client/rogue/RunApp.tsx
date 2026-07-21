/**
 * The Descent: single-player roguelite run. Entirely client-side — the run
 * lives in localStorage, hands are played by useLocalHand against ai.ts demons.
 */
import { useEffect, useMemo, useState } from 'react';
import { GATE_ART } from './art.js';
import { buildDeck } from '../../shared/engine.js';
import { ALL_DECK_IDS, DeckId, DECKS } from '../../rogue/decks.js';
import { DEMONS, rosterFor } from '../../rogue/demons.js';
import { CRACKED_HALO_CHARGES_PER_GATE, RELICS, RelicId } from '../../rogue/relics.js';
import {
  BOTTOM_INDEX,
  buildTrack,
  buyHeal,
  buyRelic,
  cleanseCard,
  CLEANSE_COST,
  consumeRelic,
  demonMaxHpsFor,
  devClearGate,
  HEAL_COST,
  leaveShop,
  newRun,
  Region,
  REROLL_COST,
  rerollShop,
  resolveHand,
  RunState,
  STOP_COUNT,
  useFerrymansCoin,
  usePactEcho,
  usePactRuin,
  usePactSeal
} from '../../rogue/run.js';
import { ENCHANTMENTS, EnchantId, TrickWin } from '../../rogue/scoring.js';
import { Card } from '../../shared/types.js';
import { play as playSound } from '../sounds.js';
import { DeckPickerModal } from './DeckPickerModal.js';
import { HandView } from './HandView.js';
import { RelicTray } from './RelicTray.js';

/** Enchants a Shop Pact can seal in (Cursed is a corruption effect, never chosen). */
const SEALABLE_ENCHANTS: EnchantId[] = ['gilded', 'royal', 'blazing', 'marked'];

const SAVE_KEY = 'thab_rogue_run';

function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    const valid =
      typeof run.seed === 'number' &&
      typeof run.stopIndex === 'number' &&
      // saves from before per-demon battles can't continue
      typeof run.hp === 'number' &&
      Array.isArray(run.demonHps);
    if (!valid) return null;
    run.lastHand ??= null;
    // Backfill fields from saves made before the persistent deck shipped.
    run.deck ??= buildDeck();
    run.crackedHaloCharges ??= CRACKED_HALO_CHARGES_PER_GATE;
    run.madeStreak ??= 0;
    run.deckId ??= 'standard';
    run.shopRerolled ??= false;
    // Saves from before the starting gift was removed may still be sitting in it.
    if ((run.phase as string) === 'gift') {
      run.phase = 'map';
      run.shopOffers = [];
    }
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
    view = <StartView onStart={(deckId) => setRun(newRun(undefined, deckId))} />;
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
        onConsumeRelic={(id) => setRun(consumeRelic(run, id))}
        devWin={() => devClearGate(run, track)}
      />
    );
  } else if (run.phase === 'shop') {
    view = <ShopView run={run} onChange={update} />;
  } else if (run.phase === 'dead' || run.phase === 'won') {
    view = <EndView run={run} onHome={() => setRun(null)} />;
  } else {
    view = (
      <MapView
        run={run}
        onPlay={() => setInHand(true)}
        onFerryman={() => update(useFerrymansCoin(run, track))}
        onChange={update}
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
  onQuit,
  onConsumeRelic,
  devWin
}: {
  run: RunState;
  trackStop: ReturnType<typeof buildTrack>[number];
  resolve: (outcome: {
    bid: number;
    taken: number;
    target?: number;
    wins?: TrickWin[];
    demonWins?: TrickWin[];
  }) => RunState;
  onContinue: (resolved: RunState) => void;
  onQuit: () => void;
  onConsumeRelic: (id: RelicId) => void;
  devWin: () => RunState;
}) {
  return (
    <HandView
      key={`${run.stopIndex}-${run.attempts}`}
      stop={trackStop}
      relics={run.relics}
      hp={run.hp}
      maxHp={run.maxHp}
      demonHps={run.demonHps}
      demonMaxHps={demonMaxHpsFor(trackStop, run.relics)}
      grace={run.grace}
      souls={run.souls}
      playerName={localStorage.getItem('thab_name') ?? 'You'}
      seed={(run.seed ^ Math.imul(run.attempts + 1, 2654435761)) >>> 0}
      deck={run.deck}
      resolve={resolve}
      onContinue={onContinue}
      onQuit={onQuit}
      onConsumeRelic={onConsumeRelic}
      devWin={devWin}
    />
  );
}

function StartView({ onStart }: { onStart: (deckId: DeckId) => void }) {
  const [deckId, setDeckId] = useState<DeckId>('standard');
  return (
    <div className="home rogue-start">
      <h1 className="title">The Descent</h1>
      <p className="subtitle">
        You died. Nine circles down, nine spheres up — one hand of cards at every gate.
        Bid exactly what you take, or the pit takes you.
      </p>
      <figure className="home-art">
        <img src="/art/gate.jpg" alt="Dante lost in the dark wood — engraving by Gustave Doré" />
        <figcaption>Gustave Doré · Inferno I</figcaption>
      </figure>
      <div className="panel">
        <h2>Choose your deck</h2>
        <div className="rogue-ruleslist" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ALL_DECK_IDS.map((id) => {
            const d = DECKS[id];
            return (
              <button
                key={id}
                type="button"
                className={`deck-option ${deckId === id ? 'deck-option-selected' : ''}`}
                onClick={() => setDeckId(id)}
              >
                <span>
                  <b>{d.name}</b>
                  <div className="rogue-flavor">{d.hook}</div>
                </span>
                {deckId === id && <span>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <h2>The rules of the pit</h2>
        <ul className="rogue-ruleslist">
          <li>
            Every gate holds a table of demons, each with its own <b>health</b>. Hands of Oh Hell
            repeat — 1 card at Circle 1, 10 at The Bottom — until one side falls.
          </li>
          <li>
            <b>Make your bid exactly</b> and you strike <b>a demon of your choosing</b> — chips
            from the tricks you won × mult from how bold your bid was (and earn souls). Slain
            demons leave the table — a bite of their soul heals you — and the lead's quirk dies
            with it.
          </li>
          <li>
            <b>Miss</b> and the table strikes back the same way — chips from the tricks *they*
            won × mult from how badly you missed by.
          </li>
          <li>
            At 0 HP, <b>grace</b> catches you: −1 grace, back to full health, and the demon keeps
            its wounds. At 0 grace, the pit keeps you.
          </li>
          <li>
            On hands of <b>4+ cards</b> the trump stays <b>face-down while you bid</b> — the
            demons can see it. Small hands play fair. Relics help.
          </li>
          <li>Souls buy relics and grace at shops every third gate — reroll the stock once per visit.</li>
          <li>Each demon warps one rule — it's shown before you play.</li>
          <li>
            Your deck is real and persistent — enchantments (and the odd demon's curse) ride the
            cards for the whole run.
          </li>
        </ul>
        <button className="btn btn-primary" onClick={() => onStart(deckId)}>
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
  onChange,
  onAbandon
}: {
  run: RunState;
  onPlay: () => void;
  onFerryman: () => void;
  onChange: (r: RunState) => void;
  onAbandon: () => void;
}) {
  const track = buildTrack(run.seed);
  const stop = track[run.stopIndex];
  const demon = DEMONS[stop.demonId];
  const roster = rosterFor(stop);
  const demonMaxHps = demonMaxHpsFor(stop, run.relics);
  const wounded = run.demonHps.some((hp, i) => hp < demonMaxHps[i]);
  const leadSlain = run.demonHps[0] === 0;
  const canFerry = run.relics.includes('ferrymansCoin') && stop.region !== 'bottom';

  return (
    <div className="home rogue-map">
      <h1 className="title">
        {stop.region === 'hell' ? 'The Descent' : stop.region === 'bottom' ? 'The Bottom' : 'The Ascent'}
      </h1>
      <Hud run={run} />

      <div className="panel map-stop">
        <figure className="gate-art">
          <img src={GATE_ART[stop.index].src} alt={GATE_ART[stop.index].caption} />
          <figcaption>Gustave Doré · {GATE_ART[stop.index].caption}</figcaption>
        </figure>
        <h2>
          {stop.label} · {stop.handSize} card{stop.handSize === 1 ? '' : 's'} · vs {stop.demonCount}{' '}
          demons
        </h2>
        <p className="rogue-flavor">
          <b>{demon.name}.</b> {demon.flavor}
        </p>
        <ul className="rogue-ruleslist">
          {roster.map((seat, i) => (
            <li key={seat.name} className={run.demonHps[i] === 0 ? 'rogue-stop-cleared' : ''}>
              {run.demonHps[i] === 0 ? '☠' : seat.isLead ? '♛' : '•'} <b>{seat.name}</b> —{' '}
              {seat.epithet}
              {run.demonHps[i] > 0 && (
                <>
                  {' '}
                  · 💀 {run.demonHps[i]}/{demonMaxHps[i]}
                </>
              )}
            </li>
          ))}
        </ul>
        {stop.demonId !== 'imp' &&
          (leadSlain ? (
            <p className="rogue-quirk rogue-quirk-lifted">
              ☠ {demon.name} is slain — the table plays fair.
            </p>
          ) : (
            <p className="rogue-quirk">⚠ {demon.quirk}</p>
          ))}
        <button className="btn btn-primary" onClick={onPlay}>
          {wounded
            ? 'Fight on — the wounds hold'
            : `${stop.region === 'heaven' ? 'Ascend' : 'Descend'} — join battle`}
        </button>
        {canFerry && (
          <button className="btn" onClick={onFerryman}>
            🪙 Use the Ferryman's Coin — skip {stop.label}
            {run.relics.filter((r) => r === 'ferrymansCoin').length > 1 &&
              ` (×${run.relics.filter((r) => r === 'ferrymansCoin').length} held)`}
          </button>
        )}
      </div>

      <div className="panel map-road">
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

      <DeckPanel run={run} onChange={onChange} />
      <RelicTray relics={run.relics} />

      <button className="btn rogue-abandon" onClick={onAbandon}>
        Abandon run
      </button>
    </div>
  );
}

/**
 * Browse the persistent deck and spend held Shop Pacts between fights: seal
 * an enchant into a chosen card, burn one out, or duplicate one. Cleansing a
 * curse is a souls-cost shop action instead — see `ShopView`.
 */
function DeckPanel({ run, onChange }: { run: RunState; onChange: (r: RunState) => void }) {
  const [mode, setMode] = useState<'browse' | 'pactSeal' | 'pactRuin' | 'pactEcho' | null>(null);
  const [sealEnchant, setSealEnchant] = useState<EnchantId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setMode(null);
    setSealEnchant(null);
    setError(null);
  };

  const tryApply = (fn: () => RunState) => {
    try {
      onChange(fn());
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const countOf = (id: RelicId) => run.relics.filter((r) => r === id).length;

  return (
    <div className="panel">
      <div className="deck-pact-bar">
        <button className="btn" onClick={() => setMode('browse')}>
          🃏 View deck ({run.deck.length})
        </button>
        {countOf('pactSeal') > 0 && (
          <button className="btn" onClick={() => setMode('pactSeal')}>
            Use Pact of Sealing{countOf('pactSeal') > 1 && ` (×${countOf('pactSeal')})`}
          </button>
        )}
        {countOf('pactRuin') > 0 && (
          <button className="btn" onClick={() => setMode('pactRuin')}>
            Use Pact of Ruin{countOf('pactRuin') > 1 && ` (×${countOf('pactRuin')})`}
          </button>
        )}
        {countOf('pactEcho') > 0 && (
          <button className="btn" onClick={() => setMode('pactEcho')}>
            Use Pact of Echoes{countOf('pactEcho') > 1 && ` (×${countOf('pactEcho')})`}
          </button>
        )}
      </div>

      {mode === 'pactSeal' && !sealEnchant && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Pact of Sealing — choose a mark</h2>
            {SEALABLE_ENCHANTS.map((id) => (
              <button
                key={id}
                className="deck-option"
                onClick={() => setSealEnchant(id)}
              >
                <span>
                  <b>{ENCHANTMENTS[id].name}</b>
                  <div className="rogue-flavor">{ENCHANTMENTS[id].effect}</div>
                </span>
              </button>
            ))}
            <button className="btn" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'browse' && <DeckPickerModal deck={run.deck} title="🃏 Your Deck" onClose={close} />}

      {mode === 'pactSeal' && sealEnchant && (
        <DeckPickerModal
          deck={run.deck}
          title={`Pact of Sealing — choose a card for ${ENCHANTMENTS[sealEnchant].name}`}
          hint={error ?? 'Only unenchanted cards can be sealed.'}
          filter={(c: Card) => !c.enchant}
          onPick={(cardId) => tryApply(() => usePactSeal(run, cardId, sealEnchant))}
          onClose={close}
        />
      )}

      {mode === 'pactRuin' && (
        <DeckPickerModal
          deck={run.deck}
          title="Pact of Ruin — choose a card to burn out of the deck"
          hint={error ?? undefined}
          onPick={(cardId) => tryApply(() => usePactRuin(run, cardId))}
          onClose={close}
        />
      )}

      {mode === 'pactEcho' && (
        <DeckPickerModal
          deck={run.deck}
          title="Pact of Echoes — choose a card to duplicate"
          hint={error ?? undefined}
          onPick={(cardId) => tryApply(() => usePactEcho(run, cardId))}
          onClose={close}
        />
      )}
    </div>
  );
}

function ShopView({ run, onChange }: { run: RunState; onChange: (r: RunState) => void }) {
  const [cleansing, setCleansing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursedCount = run.deck.filter((c) => c.enchant === 'cursed').length;

  return (
    <div className="home rogue-shop">
      <h1 className="title">🕯 The Shop Between</h1>
      <p className="subtitle">The keeper doesn't ask how you died. Souls only.</p>
      <Hud run={run} />

      <div className="panel">
        {run.shopOffers.map((id) => {
          const r = RELICS[id];
          return (
            <div key={id} className={`rogue-offer tier-${r.tier}`}>
              <div>
                <b>{r.name}</b> <span className="tier-chip">{r.tier}</span>
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
            <b>Reroll the stock</b>
            <div className="rogue-flavor">
              {run.shopRerolled ? 'Already spent this visit.' : 'A fresh draw, once per visit.'}
            </div>
          </div>
          <button
            className="btn"
            disabled={run.shopRerolled || run.souls < REROLL_COST}
            onClick={() => onChange(rerollShop(run))}
          >
            ✦ {REROLL_COST}
          </button>
        </div>
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
        {cursedCount > 0 && (
          <div className="rogue-offer">
            <div>
              <b>Cleanse a cursed card</b>
              <div className="rogue-flavor">
                {cursedCount} card{cursedCount === 1 ? '' : 's'} carry a demon's scar. Lift one.
              </div>
            </div>
            <button className="btn" disabled={run.souls < CLEANSE_COST} onClick={() => setCleansing(true)}>
              ✦ {CLEANSE_COST}
            </button>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => onChange(leaveShop(run))}>
          Back to the road
        </button>
      </div>

      {cleansing && (
        <DeckPickerModal
          deck={run.deck}
          title="Cleanse a cursed card"
          hint={error ?? `${CLEANSE_COST} souls lifts the curse.`}
          filter={(c: Card) => c.enchant === 'cursed'}
          onPick={(cardId) => {
            try {
              onChange(cleanseCard(run, cardId));
              setCleansing(false);
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          onClose={() => {
            setCleansing(false);
            setError(null);
          }}
        />
      )}

      <RelicTray relics={run.relics} />
    </div>
  );
}

function EndView({ run, onHome }: { run: RunState; onHome: () => void }) {
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
        <button className="btn btn-primary" onClick={onHome}>
          {won ? '⛩ Return to the gate' : 'Return to the gate'}
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

