import { useState } from 'react';
import { RELICS, RelicId } from '../../rogue/relics.js';

/** Collapsed-by-default satchel: a button that unfolds the relic list. */
export function RelicTray({ relics }: { relics: RelicId[] }) {
  const [open, setOpen] = useState(false);
  if (relics.length === 0) return null;
  // Stacked consumables (Trump Anchor, the Pacts, Ferryman's Coin) hold
  // multiple copies as repeated entries — group them so owning 2+ shows a
  // ×N badge instead of two identical-looking rows.
  const counts = new Map<RelicId, number>();
  for (const id of relics) counts.set(id, (counts.get(id) ?? 0) + 1);
  return (
    <div className="relic-tray">
      <button className="btn relic-toggle" onClick={() => setOpen((o) => !o)}>
        🎒 Relics ({relics.length}) {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="relic-drop">
          {Array.from(counts.entries()).map(([id, count]) => (
            <div key={id} className={`rogue-flavor tier-${RELICS[id].tier}`}>
              <b>{RELICS[id].name}</b>
              {count > 1 && <span className="relic-count">×{count}</span>}{' '}
              <span className="tier-chip">{RELICS[id].tier}</span> — {RELICS[id].effect}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
