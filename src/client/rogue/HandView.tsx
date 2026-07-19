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
  onQuit,
  devWin
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
  /** TEMPORARY dev shortcut: the gate resolved as if every demon fell */
  devWin: () => RunState;
}) {
  const [devReport, setDevReport] = useState<RunState | null>(null);
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
  const feltRef = useRef<HTMLDivElement>(null);
  const drag = useFanDrag(
    fanRef,
    feltRef,
    setOrder,
    (id) => state.phase === 'playing' && state.turn === 0 && hand.legalPlays.includes(id),
    (id) => hand.play(id)
  );
  drag.displayed.current = fanCards.map((c) => c.id);
  const dropPlayable =
    drag.dragId !== null &&
    state.phase === 'playing' &&
    myTurn &&
    hand.legalPlays.includes(drag.dragId);

  return (
    <div className="game rogue-hand">
      <header className="topbar">
        <div className="hand-info">
          <b>{stop.label}</b> · {stop.handSize} card{stop.handSize === 1 ? '' : 's'} ·{' '}
          <span className="rogue-demon-tag" title={demon.quirk}>
            {demon.name}
          </span>
        </div>
        <div className="topbar-right">
          <span className="rogue-hud">🕊 {grace}</span>
          <span className="rogue-hud">✦ {souls}</span>
          <button className="btn rogue-quit rogue-dev" onClick={() => setDevReport(devWin())}>
            ⚙ Win
          </button>
          <button className="btn rogue-quit" onClick={onQuit}>
            ✕ Quit
          </button>
        </div>
      </header>

      <div className="flank-demons">
        {roster.map((seatDef, ri) => {
          if (demonHps[ri] === 0) {
            return (
              <div className="player-badge demon-card hp-dead" key={seatDef.name}>
                <div className="player-name">☠ {seatDef.name}</div>
              </div>
            );
          }
          const seat = hand.seatRoster.indexOf(ri) + 1;
          return (
            <div
              key={seatDef.name}
              className={`player-badge demon-card ${seat === state.turn ? 'player-turn' : ''}`}
            >
              <div className="player-name">
                {seatDef.isLead && <span title="Lead demon — its quirk dies with it">♛</span>}
                {seatDef.name}
                {seat === state.dealer && <span className="dealer-chip" title="Dealer">D</span>}
              </div>
              <div className="hp-label">
                💀 {demonHps[ri]}/{demonMaxHps[ri]}
              </div>
              <div className="hpbar">
                <span
                  className="hpbar-fill hpbar-demon"
                  style={{ width: `${(demonHps[ri] / demonMaxHps[ri]) * 100}%` }}
                />
              </div>
              <div className="player-line">
                {state.bids[seat] === null ? (
                  <span className="muted">
                    {bidding ? (seat === state.turn ? 'bidding…' : 'waits to bid') : '—'}
                  </span>
                ) : bidding ? (
                  <span>
                    bids <b>{hideBids ? '?' : state.bids[seat]}</b>
                  </span>
                ) : (
                  <span>
                    took <b>{hideTaken ? '?' : state.tricksTaken[seat]}</b> of{' '}
                    <b>{hideBids ? '?' : state.bids[seat]}</b> bid
                  </span>
                )}
              </div>
              {(hand.demonHands[seat - 1]?.length ?? 0) > 0 && (
                <div className="demon-backs">
                  {hand.demonHands[seat - 1].map((card) => {
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
          );
        })}
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
      </div>

      <div className="stage">
        <div
          ref={feltRef}
          className={`table-felt ${drag.overFelt && dropPlayable ? 'felt-drop' : ''}`}
        >
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
      </div>

      <div className="flank-you">
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
        <div className={`player-badge you-card ${state.turn === 0 ? 'player-turn' : ''}`}>
          <div className="player-name">
            {playerName || 'You'}
            <span className="you-tag"> (you)</span>
            {state.dealer === 0 && <span className="dealer-chip" title="Dealer">D</span>}
          </div>
          <div className="hp-label">
            ❤ {hp}/{maxHp}
          </div>
          <div className="hpbar">
            <span className="hpbar-fill hpbar-you" style={{ width: `${(hp / maxHp) * 100}%` }} />
          </div>
          <div className="player-line">
            {state.bids[0] === null ? (
              <span className="muted">{bidding ? (myTurn ? 'bidding…' : 'waits to bid') : '—'}</span>
            ) : bidding ? (
              <span>
                bids <b>{state.bids[0]}</b>
              </span>
            ) : (
              <span>
                took <b>{state.tricksTaken[0]}</b> of <b>{state.bids[0]}</b> bid
              </span>
            )}
          </div>
        </div>
        <RelicTray relics={relics} />
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
            const lifted = drag.dragId === card.id;
            return (
              <CardView
                key={card.id}
                card={card}
                size="lg"
                disabled={state.phase === 'playing' && myTurn && !playable}
                onClick={
                  playable
                    ? () => {
                        if (!drag.wasDrag.current) hand.play(card.id);
                      }
                    : undefined
                }
                onPointerDown={drag.arm(card.id)}
                style={{
                  animationDelay: `${i * 45}ms`,
                  ...(lifted ? { opacity: 0.35 } : {})
                }}
              />
            );
          })}
        </div>
      </div>

      {drag.dragId && drag.pos && byId.has(drag.dragId) && (
        <div className="card-ghost" style={{ left: drag.pos.x, top: drag.pos.y }}>
          <CardView card={byId.get(drag.dragId)!} size="lg" />
        </div>
      )}

      {devReport && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>⚙ The gate yields</h2>
            <p className="winner-line">
              Every demon at {stop.label} falls where it sits. (Dev shortcut.)
            </p>
            <button className="btn btn-primary" onClick={() => onContinue(devReport)}>
              Onward
            </button>
          </div>
        </div>
      )}
      {!devReport && hand.result && (
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
 * Unified hand-fan drag. Mouse: press and drag past a small threshold.
 * Touch: hold ~250ms to lift (so the fan can still scroll sideways), then drag.
 * While lifted, a fixed-position ghost follows the pointer and the original
 * card dims in place. Over the fan, the card jumps into slots live (reorder);
 * over the table felt, a playable card highlights the felt and dropping it
 * plays it. A tap without a drag still plays the card.
 */
function useFanDrag(
  fanRef: React.RefObject<HTMLDivElement>,
  feltRef: React.RefObject<HTMLDivElement>,
  setOrder: React.Dispatch<React.SetStateAction<string[]>>,
  canPlay: (id: string) => boolean,
  onPlay: (id: string) => void
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [overFelt, setOverFelt] = useState(false);
  const dragRef = useRef<string | null>(null);
  const overFeltRef = useRef(false);
  const wasDrag = useRef(false);
  const displayed = useRef<string[]>([]);
  // latest callbacks without re-subscribing the window listeners
  const cbRef = useRef({ canPlay, onPlay });
  cbRef.current = { canPlay, onPlay };
  const startRef = useRef<{
    id: string;
    x: number;
    y: number;
    pointerId: number;
    touch: boolean;
  } | null>(null);
  const holdTimer = useRef(0);

  useEffect(() => {
    const lift = (id: string, x: number, y: number) => {
      dragRef.current = id;
      wasDrag.current = true; // the click after pointerup must not play the card
      setDragId(id);
      setPos({ x, y });
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
        lift(s.id, e.clientX, e.clientY);
      }
      const id = dragRef.current;
      if (!id) return;
      setPos({ x: e.clientX, y: e.clientY });

      const feltRect = feltRef.current?.getBoundingClientRect();
      const onFelt =
        !!feltRect &&
        e.clientX >= feltRect.left &&
        e.clientX <= feltRect.right &&
        e.clientY >= feltRect.top &&
        e.clientY <= feltRect.bottom;
      overFeltRef.current = onFelt;
      setOverFelt(onFelt);
      if (onFelt) return; // aiming at the table: hold the fan order still

      const fan = fanRef.current;
      if (!fan) return;
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
      const id = dragRef.current;
      const dropOnFelt = overFeltRef.current;
      startRef.current = null;
      dragRef.current = null;
      overFeltRef.current = false;
      setDragId(null);
      setPos(null);
      setOverFelt(false);
      if (id && dropOnFelt && e.type === 'pointerup' && cbRef.current.canPlay(id)) {
        cbRef.current.onPlay(id);
      }
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
  }, [fanRef, feltRef, setOrder]);

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
    const { clientX, clientY } = e;
    startRef.current = { id, x: clientX, y: clientY, pointerId: e.pointerId, touch };
    if (touch) {
      clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => {
        if (startRef.current?.id === id) {
          dragRef.current = id;
          wasDrag.current = true;
          setDragId(id);
          setPos({ x: clientX, y: clientY });
        }
      }, 250);
    }
  };

  return { dragId, pos, overFelt, wasDrag, displayed, arm };
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
