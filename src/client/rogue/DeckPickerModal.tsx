import { enchantTitle, ENCHANTMENTS, EnchantId } from '../../rogue/scoring.js';
import { Card, Suit, SUIT_GLYPHS, SUIT_NAMES } from '../../shared/types.js';
import { CardView } from '../components.js';

const SUIT_ORDER: Suit[] = ['S', 'H', 'D', 'C'];

/**
 * Browses the run's persistent deck, grouped by suit, with each card's
 * enchantment (if any) badged underneath. Used for: browsing the deck,
 * choosing a target card for a Shop Pact, and choosing a cursed card to
 * cleanse. `filter` narrows which cards are clickable — the rest still show,
 * dimmed, so the deck reads as a whole.
 */
export function DeckPickerModal({
  deck,
  title,
  hint,
  filter,
  onPick,
  onClose
}: {
  deck: Card[];
  title: string;
  hint?: string;
  /** cards failing this stay visible but unclickable; omit to allow any card */
  filter?: (card: Card) => boolean;
  onPick?: (cardId: string) => void;
  onClose: () => void;
}) {
  const bySuit = SUIT_ORDER.map((suit) => ({
    suit,
    cards: deck.filter((c) => c.suit === suit).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
  }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal deck-picker" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {hint && <p className="rogue-flavor">{hint}</p>}
        <div className="deck-grid">
          {bySuit.map(({ suit, cards }) => (
            <div className="deck-suit-row" key={suit}>
              <div className="deck-suit-label">
                {SUIT_GLYPHS[suit]} {SUIT_NAMES[suit]} · {cards.length}
              </div>
              <div className="deck-suit-cards">
                {cards.map((c) => {
                  const pickable = !!onPick && (!filter || filter(c));
                  const enchant = c.enchant as EnchantId | undefined;
                  return (
                    <div className="deck-card-slot" key={c.id}>
                      <CardView
                        card={c}
                        size="sm"
                        disabled={!pickable}
                        title={enchantTitle(c.enchant)}
                        onClick={pickable ? () => onPick!(c.id) : undefined}
                      />
                      {enchant && ENCHANTMENTS[enchant] && (
                        <span className={`enchant-badge enchant-${enchant}`} title={ENCHANTMENTS[enchant].effect}>
                          {ENCHANTMENTS[enchant].name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
