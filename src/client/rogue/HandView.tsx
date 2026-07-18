import { DEMONS } from '../../rogue/demons.js';
import { RelicId } from '../../rogue/relics.js';
import { isTrumpBlind, RunState, StopDef } from '../../rogue/run.js';
import { SUIT_GLYPHS, SUIT_NAMES } from '../../shared/types.js';
import { CardView } from '../components.js';
import { useLocalHand } from './useLocalHand.js';

export function HandView({
  stop,
  relics,
  hp,
  maxHp,
  demonHp,
  demonMaxHp,
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
  demonHp: number;
  demonMaxHp: number;
  grace: number;
  souls: number;
  playerName: string;
  seed: number;
  /** pure battle resolution for a finished hand, so the modal can report it */
  resolve: (outcome: { bid: number; taken: number }) => RunState;
  onContinue: (resolved: RunState) => void;
  onQuit: () => void;
}) {
  const hand = useLocalHand(stop, playerName, seed);
  const { state } = hand;
  const demon = DEMONS[stop.demonId];
  const bidding = state.phase === 'bidding';
  const myTurn = state.turn === 0;
  const trumpHidden = bidding && isTrumpBlind(stop.handSize) && !relics.includes('loadedDie');
  const hideBids = stop.demonId === 'liar' && !hand.result;
  const hideTaken = stop.demonId === 'hoarder' && !hand.result;
  const myBid = state.bids[0];
  const bidDead =
    state.phase === 'playing' && myBid !== null && state.tricksTaken[0] > myBid && !hand.result;

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
        <div className="hp-block">
          <div className="hp-label">
            {demon.name} · 💀 {demonHp}/{demonMaxHp}
          </div>
          <div className="hpbar">
            <span
              className="hpbar-fill hpbar-demon"
              style={{ width: `${(demonHp / demonMaxHp) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {stop.demonId !== 'imp' && <div className="rogue-quirk">⚠ {demon.quirk}</div>}
      {relics.includes('graveLedger') && (
        <div className="rogue-quirk rogue-ledger">
          Grave Ledger: {hand.trumpsPlayed} trump{hand.trumpsPlayed === 1 ? '' : 's'} played
        </div>
      )}

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
        <div className="hand-fan">
          {hand.sortedHand.map((card, i) => {
            const playable = state.phase === 'playing' && myTurn && hand.legalPlays.includes(card.id);
            return (
              <CardView
                key={card.id}
                card={card}
                size="lg"
                disabled={state.phase === 'playing' && myTurn && !playable}
                onClick={playable ? () => hand.play(card.id) : undefined}
                style={{ animationDelay: `${i * 45}ms` }}
              />
            );
          })}
        </div>
      </div>

      {hand.result && <BattleReport outcome={hand.result} resolve={resolve} demonName={demon.name} onContinue={onContinue} />}
    </div>
  );
}

/** The post-hand modal: how the blow landed, and where the battle stands. */
function BattleReport({
  outcome,
  resolve,
  demonName,
  onContinue
}: {
  outcome: { bid: number; taken: number };
  resolve: (outcome: { bid: number; taken: number }) => RunState;
  demonName: string;
  onContinue: (resolved: RunState) => void;
}) {
  const report = resolve(outcome);
  const lh = report.lastHand!;
  const dead = report.phase === 'dead';
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{lh.won ? `☠ ${demonName} falls` : lh.made ? '⚔ Bid made' : '✗ Bid missed'}</h2>
        <p className="winner-line">
          You bid <b>{outcome.bid}</b> and took <b>{outcome.taken}</b>.
        </p>
        {lh.made && !lh.won && (
          <p className="winner-line">
            <b>{lh.dmgDealt}</b> damage — {demonName} has <b>{report.demonHp}</b> HP left.
          </p>
        )}
        {lh.won && (
          <p className="winner-line">
            <b>{lh.dmgDealt}</b> damage fells it. The gate opens.
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
            left, and {demonName} keeps its wounds.
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
