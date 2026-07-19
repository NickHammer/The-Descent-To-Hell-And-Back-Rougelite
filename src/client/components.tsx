import { Card, SUIT_GLYPHS, rankLabel } from '../shared/types.js';

/** Standard pip positions per rank as [x%, y%]; pips below the midline render upside down. */
const PIPS: Record<number, [number, number][]> = {
  2: [[50, 20], [50, 80]],
  3: [[50, 20], [50, 50], [50, 80]],
  4: [[34, 20], [66, 20], [34, 80], [66, 80]],
  5: [[34, 20], [66, 20], [50, 50], [34, 80], [66, 80]],
  6: [[34, 20], [66, 20], [34, 50], [66, 50], [34, 80], [66, 80]],
  7: [[34, 20], [66, 20], [50, 35], [34, 50], [66, 50], [34, 80], [66, 80]],
  8: [[34, 20], [66, 20], [50, 35], [34, 50], [66, 50], [50, 65], [34, 80], [66, 80]],
  9: [[34, 17], [66, 17], [34, 39], [66, 39], [50, 50], [34, 61], [66, 61], [34, 83], [66, 83]],
  10: [[34, 17], [66, 17], [50, 28], [34, 39], [66, 39], [34, 61], [66, 61], [50, 72], [34, 83], [66, 83]],
  14: [[50, 50]]
};

export function CardView({
  card,
  size = 'md',
  disabled = false,
  highlight = false,
  onClick,
  onPointerDown,
  style
}: {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
}) {
  const red = card.suit === 'H' || card.suit === 'D';
  const glyph = SUIT_GLYPHS[card.suit];
  const label = rankLabel(card.rank);
  const isCourt = card.rank >= 11 && card.rank <= 13;
  const classes = [
    'card',
    `card-${size}`,
    red ? 'card-red' : 'card-black',
    disabled ? 'card-disabled' : '',
    highlight ? 'card-highlight' : '',
    onClick && !disabled ? 'card-clickable' : ''
  ]
    .filter(Boolean)
    .join(' ');

  // No native `disabled` attribute: a disabled button swallows the pointer
  // events the hand fan needs for drag-reorder. The class + guarded onClick
  // preserve the disabled look and behavior.
  return (
    <button
      className={classes}
      onClick={disabled ? undefined : onClick}
      onPointerDown={onPointerDown}
      style={style}
    >
      <span className="card-corner">
        {label}
        <br />
        {glyph}
      </span>
      <span className="card-corner card-corner-br">
        {label}
        <br />
        {glyph}
      </span>
      {isCourt ? (
        <span className="card-court">
          <span className="court-glyph court-top">{glyph}</span>
          <span className="court-letter">{label}</span>
          <span className="court-glyph court-bottom">{glyph}</span>
        </span>
      ) : (
        <span className="card-pips">
          {PIPS[card.rank].map(([x, y], i) => (
            <span
              key={i}
              className={`pip ${y > 50 ? 'pip-flip' : ''} ${card.rank === 14 ? 'pip-ace' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {glyph}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
