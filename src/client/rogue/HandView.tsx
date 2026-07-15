import { DEMONS } from '../../rogue/demons.js';
import { RelicId } from '../../rogue/relics.js';
import { StopDef } from '../../rogue/run.js';
import { SUIT_GLYPHS, SUIT_NAMES } from '../../shared/types.js';
import { CardView } from '../components.js';
import { useLocalHand } from './useLocalHand.js';

export function HandView({
  stop,
  relics,
  grace,
  souls,
  playerName,
  seed,
  onDone
}: {
  stop: StopDef;
  relics: RelicId[];
  grace: number;
  souls: number;
  playerName: string;
  seed: number;
  onDone: (outcome: { bid: number; taken: number }) => void;
}) {
  const hand = useLocalHand(stop, playerName, seed);
  const { state } = hand;
  const demon = DEMONS[stop.demonId];
  const bidding = state.phase === 'bidding';
  const myTurn = state.turn === 0;
  const trumpHidden = bidding && !relics.includes('loadedDie');
  const hideBids = stop.demonId === 'liar' && !hand.result;
  const hideTaken = stop.demonId === 'hoarder' && !hand.result;

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
          <span className="rogue-hud">❤ {grace}</span>
          <span className="rogue-hud">✦ {souls}</span>
        </div>
      </header>

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
                <span className="muted">{bidding ? (i === state.turn ? 'bidding…' : 'waiting') : '—'}</span>
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
          <div className="table-hintline">
            {bidding
              ? myTurn
                ? 'Your bid.'
                : `${state.players[state.turn]?.name ?? '…'} is bidding…`
              : myTurn
                ? 'Your lead.'
                : `${state.players[state.turn]?.name ?? '…'} leads…`}
          </div>
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

      {hand.result && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{hand.result.bid === hand.result.taken ? '⚖ Bid made' : '✗ Bid missed'}</h2>
            <p className="winner-line">
              You bid <b>{hand.result.bid}</b> and took <b>{hand.result.taken}</b>.
            </p>
            <button className="btn btn-primary" onClick={() => onDone(hand.result!)}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
