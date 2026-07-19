import { useEffect, useRef, useState } from 'react';
import { DEMONS, rosterFor } from '../../rogue/demons.js';
import { RelicId } from '../../rogue/relics.js';
import { FELL_HEAL, isTrumpBlind, RunState, StopDef } from '../../rogue/run.js';
import { SUIT_GLYPHS, SUIT_NAMES } from '../../shared/types.js';
import { CardView } from '../components.js';
import { RelicTray } from './RelicTray.js';
import { useLocalHand } from './useLocalHand.js';

export function HandView({
  stop,
  relics,
  hp,
  maxHp,
  demonHps,
  demonMaxHps,
  grace,
  souls,
  playerName,
  seed,
  resolve,
  onContinue,
  onQuit
}: {
  stop: StopDef;
  relics: RelicId[];
  hp: number;
  maxHp: number;
  demonHps: number[];
  demonMaxHps: number[];
  grace: number;
  souls: number;
  playerName: string;
  seed: number;
  /** pure battle resolution for a finished hand, so the modal can report it */
  resolve: (outcome: { bid: number; taken: number; target?: number }) => RunState;
  onContinue: (resolved: RunState) => void;
  onQuit: () => void;
}) {
  const hand = useLocalHand(stop, demonHps, playerName, seed);
  const { state } = hand;
  const demon = DEMONS[stop.demonId];
  const roster = rosterFor(stop);
  const leadAliveNow = demonHps[0] > 0;
  const bidding = state.phase === 'bidding';
  const myTurn = state.turn === 0;
  const trumpHidden = bidding && isTrumpBlind(stop.handSize) && !relics.includes('loadedDie');
  const hideBids = stop.demonId === 'liar' && leadAliveNow && !hand.result;
  const hideTaken = stop.demonId === 'hoarder' && leadAliveNow && !hand.result;
  const myBid = state.bids[0];
  const bidDead =
    state.phase === 'playing' && myBid !== null && state.tricksTaken[0] > myBid && !hand.result;

  // Player-chosen card order: starts from the auto-sort, then drag to taste.
  const fanRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[]>(() => hand.sortedHand.map((c) => c.id));
  const handSize = state.hands[0].length;
  useEffect(() => {
    // prune played cards so `order` always mirrors what's on screen
    setOrder((prev) => {
      const live = new Set(hand.sortedHand.map((c) => c.id));
      const kept = prev.filter((id) => live.has(id));
      for (const c of hand.sortedHand) if (!kept.includes(c.id)) kept.push(c.id);
      return kept.length === prev.length && kept.every((id, i) => id === prev[i]) ? prev : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handSize]);
  const byId = new Map(hand.sortedHand.map((c) => [c.id, c]));
  const fanCards = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const reorder = useFanReorder(fanRef, setOrder);
  reorder.displayed.current = fanCards.map((c) => c.id);

  return (
    <div className="game rogue-hand">
      <header className="topbar">
        <div className="hand-info">
          <b>{stop.label}</b> · {stop.handSize} card{stop.handSize === 1 ? '' : 's'} ·{' '}
          <span className="rogue-demon-tag" title={demon.quirk}>
            {demon.name}
          </span>
        </div>
        <div className="trump-info">
          Trump:{' '}
          {trumpHidden ? (
            <span className="card card-md rogue-card-back" title="Face-down until bids are locked" />
          ) : (
            <>
              <CardView card={state.trumpCard!} size="md" />
              <span className="trump-name">{SUIT_NAMES[state.trumpCard!.suit]}</span>
            </>
          )}
        </div>
        <div className="topbar-right">
          <span className="rogue-hud">🕊 {grace}</span>
          <span className="rogue-hud">✦ {souls}</span>
          <button className="btn rogue-quit" onClick={onQuit}>
            ✕ Quit
          </button>
        </div>
      </header>

      <div className="battle-bar">
        <div className="hp-block">
          <div className="hp-label">
            {playerName || 'You'} · ❤ {hp}/{maxHp}
          </div>
          <div className="hpbar">
            <span className="hpbar-fill hpbar-you" style={{ width: `${(hp / maxHp) * 100}%` }} />
          </div>
        </div>
        {roster.map((seat, i) =>
          demonHps[i] > 0 ? (
            <div className="hp-block" key={seat.name}>
              <div className="hp-label">
                {seat.isLead && '♛ '}
                {seat.name} · 💀 {demonHps[i]}/{demonMaxHps[i]}
              </div>
              <div className="hpbar">
                <span
                  className="hpbar-fill hpbar-demon"
                  style={{ width: `${(demonHps[i] / demonMaxHps[i]) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="hp-block hp-dead" key={seat.name}>
              <div className="hp-label">☠ {seat.name}</div>
            </div>
          )
        )}
      </div>

      {stop.demonId !== 'imp' &&
        (leadAliveNow ? (
          <div className="rogue-quirk">⚠ {demon.quirk}</div>
        ) : (
          <div className="rogue-quirk rogue-quirk-lifted">
            ☠ {demon.name} is slain — the table plays fair.
          </div>
        ))}
      {relics.includes('graveLedger') && (
        <div className="rogue-quirk rogue-ledger">
          Grave Ledger: {hand.trumpsPlayed} trump{hand.trumpsPlayed === 1 ? '' : 's'} played
        </div>
      )}
      <RelicTray relics={relics} />

      <div className="players-strip">
        {state.players.map((p, i) => (
          <div key={i} className={`player-badge ${i === state.turn ? 'player-turn' : ''}`}>
            <div className="player-name">
              {p.name}
              {i === 0 && <span className="you-tag"> (you)</span>}
              {i === state.dealer && <span className="dealer-chip" title="Dealer">D</span>}
            </div>
            <div className="player-line">
              {state.bids[i] === null ? (
                <span className="muted">{bidding ? (i === state.turn ? 'bidding…' : 'waits to bid') : '—'}</span>
              ) : bidding ? (
                <span>
                  bids <b>{i > 0 && hideBids ? '?' : state.bids[i]}</b>
                </span>
              ) : (
                <span>
                  took <b>{i > 0 && hideTaken ? '?' : state.tricksTaken[i]}</b> of{' '}
                  <b>{i > 0 && hideBids ? '?' : state.bids[i]}</b> bid
                </span>
              )}
            </div>
            {i > 0 && (hand.demonHands[i - 1]?.length ?? 0) > 0 && (
              <div className="demon-backs">
                {hand.demonHands[i - 1].map((card) => {
                  const smoke = relics.includes('devilsLettuce') && card.rank >= 12;
                  const ember =
                    relics.includes('trumpVision') && card.suit === state.trumpCard!.suit;
                  return (
                    <span
                      key={card.id}
                      className={`mini-card-back ${smoke ? 'back-smoke' : ''} ${ember ? 'back-ember' : ''}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="table-felt">
        {hand.trumpShifted && state.trumpCard && (
          <div className="winner-banner rogue-shift">
            The trump shifts to {SUIT_GLYPHS[state.trumpCard.suit]} {SUIT_NAMES[state.trumpCard.suit]}!
          </div>
        )}
        {state.trick.length === 0 && state.trickWinner === null ? (
          <>
            <div className="table-hintline">
              {bidding
                ? myTurn
                  ? 'Your bid.'
                  : `${state.players[state.turn]?.name ?? '…'} is bidding…`
                : myTurn
                  ? 'Your lead.'
                  : `${state.players[state.turn]?.name ?? '…'} leads…`}
            </div>
            {bidding && hand.lastBid && (
              <div className="winner-banner" key={`bid-${hand.lastBid.seat}`}>
                {state.players[hand.lastBid.seat].name} bids{' '}
                {hand.lastBid.seat > 0 && hideBids ? '… something' : hand.lastBid.bid}
              </div>
            )}
            {!bidding && state.tricksTaken.every((t) => t === 0) && (
              <div className="table-hintline small">
                {state.players[state.trickLeader]?.name ?? '…'} leads the first trick — one seat
                left of the first bidder
              </div>
            )}
          </>
        ) : (
          <div className="trick-area">
            {state.trick.map((tc, i) => (
              <div
                key={tc.card.id}
                className={`trick-card ${state.trickWinner === tc.seat ? 'trick-winner' : ''}`}
              >
                <CardView card={tc.card} size="lg" />
                <div className="trick-name">
                  {state.players[tc.seat].name}
                  {i === 0 && <span className="led-chip">led</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {state.trickWinner !== null && (
          <div className="winner-banner">{state.players[state.trickWinner].name} takes the trick</div>
        )}
      </div>

      <div className="my-area">
        {bidDead && !hand.hurrying && (
          <button className="btn rogue-quit" onClick={hand.hurry}>
            ⏩ The bid is dead — skip ahead
          </button>
        )}
        {bidding && myTurn && (
          <div className="bid-picker">
            <div className="bid-label">
              How many tricks will you take{trumpHidden ? ' (trump unknown)' : ''}?
            </div>
            <div className="bid-buttons">
              {Array.from({ length: stop.handSize + 1 }, (_, b) => (
                <button
                  key={b}
                  className="btn bid-btn"
                  disabled={!hand.legalBids.includes(b)}
                  onClick={() => hand.bid(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="hand-fan" ref={fanRef}>
          {fanCards.map((card, i) => {
            const playable = state.phase === 'playing' && myTurn && hand.legalPlays.includes(card.id);
            const lifted = reorder.dragId === card.id;
            return (
              <CardView
                key={card.id}
                card={card}
                size="lg"
                disabled={state.phase === 'playing' && myTurn && !playable}
                onClick={
                  playable
                    ? () => {
                        if (!reorder.wasDrag.current) hand.play(card.id);
                      }
                    : undefined
                }
                onPointerDown={reorder.arm(card.id)}
                style={{
                  animationDelay: `${i * 45}ms`,
                  ...(lifted
                    ? {
                        transform: 'translateY(-14px) scale(1.07)',
                        zIndex: 20,
                        boxShadow: '0 10px 22px rgba(0, 0, 0, 0.5)',
                        cursor: 'grabbing'
                      }
                    : {})
                }}
              />
            );
          })}
        </div>
      </div>

      {hand.result && (
        <BattleReport
          outcome={hand.result}
          resolve={resolve}
          roster={roster}
          demonHps={demonHps}
          demonMaxHps={demonMaxHps}
          onContinue={onContinue}
        />
      )}
    </div>
  );
}

/**
 * Drag-to-reorder for the hand fan. Mouse: press and drag past a small
 * threshold. Touch: hold ~250ms to lift (so the fan can still scroll
 * sideways), then drag. The lifted card jumps into slots live as the pointer
 * crosses its neighbors' midpoints; a tap without a drag still plays the card.
 */
function useFanReorder(
  fanRef: React.RefObject<HTMLDivElement>,
  setOrder: React.Dispatch<React.SetStateAction<string[]>>
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  const wasDrag = useRef(false);
  const displayed = useRef<string[]>([]);
  const startRef = useRef<{
    id: string;
    x: number;
    y: number;
    pointerId: number;
    touch: boolean;
  } | null>(null);
  const holdTimer = useRef(0);

  useEffect(() => {
    const lift = (id: string) => {
      dragRef.current = id;
      wasDrag.current = true; // the click after pointerup must not play the card
      setDragId(id);
    };

    const onMove = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (!dragRef.current) {
        const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
        if (moved <= 8) return;
        if (s.touch) {
          // the finger is scrolling the fan, not lifting a card
          clearTimeout(holdTimer.current);
          startRef.current = null;
          return;
        }
        lift(s.id);
      }
      const fan = fanRef.current;
      const id = dragRef.current;
      if (!fan || !id) return;
      const els = Array.from(fan.querySelectorAll<HTMLElement>('.card'));
      const mids = displayed.current
        .map((cardId, i) => {
          const rect = els[i]?.getBoundingClientRect();
          return rect ? { cardId, mid: rect.left + rect.width / 2 } : null;
        })
        .filter((m): m is { cardId: string; mid: number } => m !== null && m.cardId !== id);
      const insert = mids.filter((m) => m.mid < e.clientX).length;
      setOrder((prev) => {
        const rest = prev.filter((cardId) => cardId !== id);
        if (rest.length === prev.length) return prev;
        rest.splice(insert, 0, id);
        return rest.every((cardId, i) => cardId === prev[i]) ? prev : rest;
      });
    };

    const onUp = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      clearTimeout(holdTimer.current);
      startRef.current = null;
      dragRef.current = null;
      setDragId(null);
      // let the synthetic click (fired right after pointerup) see the flag
      window.setTimeout(() => {
        wasDrag.current = false;
      }, 0);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [fanRef, setOrder]);

  // While a touch drag is lifted, block the fan's native horizontal scroll.
  useEffect(() => {
    const fan = fanRef.current;
    if (!fan) return;
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    fan.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => fan.removeEventListener('touchmove', onTouchMove);
  }, [fanRef]);

  const arm = (id: string) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const touch = e.pointerType !== 'mouse';
    startRef.current = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, touch };
    if (touch) {
      clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => {
        if (startRef.current?.id === id) {
          dragRef.current = id;
          wasDrag.current = true;
          setDragId(id);
        }
      }, 250);
    }
  };

  return { dragId, wasDrag, displayed, arm };
}

/**
 * The post-hand modal. A made bid with several demons standing asks where the
 * blow lands first; then (or otherwise) it reports how the hand resolved.
 */
function BattleReport({
  outcome,
  resolve,
  roster,
  demonHps,
  demonMaxHps,
  onContinue
}: {
  outcome: { bid: number; taken: number };
  resolve: (outcome: { bid: number; taken: number; target?: number }) => RunState;
  roster: ReturnType<typeof rosterFor>;
  demonHps: number[];
  demonMaxHps: number[];
  onContinue: (resolved: RunState) => void;
}) {
  const made = outcome.bid === outcome.taken;
  const living = demonHps.map((hp, i) => (hp > 0 ? i : -1)).filter((i) => i >= 0);
  const [target, setTarget] = useState<number | null>(
    made && living.length === 1 ? living[0] : null
  );

  if (made && target === null) {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2>⚔ Bid made — choose where the blow lands</h2>
          <p className="winner-line">
            You bid <b>{outcome.bid}</b> and took <b>{outcome.taken}</b>.
          </p>
          {living.map((i) => (
            <button key={i} className="btn target-btn" onClick={() => setTarget(i)}>
              <b>
                {roster[i].isLead && '♛ '}
                {roster[i].name}
              </b>{' '}
              — {roster[i].epithet} · 💀 {demonHps[i]}/{demonMaxHps[i]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const report = resolve(made ? { ...outcome, target: target! } : outcome);
  const lh = report.lastHand!;
  const dead = report.phase === 'dead';
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>
          {lh.won
            ? '☠ The table is cleared'
            : lh.felled
              ? `☠ ${lh.targetName} falls`
              : lh.made
                ? '⚔ Bid made'
                : '✗ Bid missed'}
        </h2>
        <p className="winner-line">
          You bid <b>{outcome.bid}</b> and took <b>{outcome.taken}</b>.
        </p>
        {lh.made && !lh.won && !lh.felled && (
          <p className="winner-line">
            <b>{lh.dmgDealt}</b> damage — {lh.targetName} has{' '}
            <b>{report.demonHps[target!]}</b> HP left.
          </p>
        )}
        {lh.made && lh.felled && !lh.won && (
          <p className="winner-line">
            <b>{lh.dmgDealt}</b> damage. {lh.targetName} leaves the table
            {target === 0 && ' — its rule dies with it'}. A bite of its soul restores{' '}
            <b>{FELL_HEAL} HP</b>.
          </p>
        )}
        {lh.won && (
          <p className="winner-line">
            <b>{lh.dmgDealt}</b> damage fells {lh.targetName}, the last of them. The gate opens.
          </p>
        )}
        {!lh.made && lh.dmgTaken === 0 && (
          <p className="winner-line">The Cracked Halo holds — no blood drawn.</p>
        )}
        {!lh.made && lh.dmgTaken > 0 && !lh.respawned && !dead && (
          <p className="winner-line">
            You take <b>{lh.dmgTaken}</b> — {report.hp}/{report.maxHp} HP left.
          </p>
        )}
        {lh.respawned && (
          <p className="winner-line">
            You take <b>{lh.dmgTaken}</b> and fall — <b>grace catches you</b>. {report.grace} grace
            left, and the demons keep their wounds.
          </p>
        )}
        {dead && (
          <p className="winner-line">
            You take <b>{lh.dmgTaken}</b> and fall. Your last grace gutters out.
          </p>
        )}
        <button className="btn btn-primary" onClick={() => onContinue(report)}>
          {lh.won ? 'Onward' : dead ? 'The reckoning' : 'Fight on'}
        </button>
      </div>
    </div>
  );
}
