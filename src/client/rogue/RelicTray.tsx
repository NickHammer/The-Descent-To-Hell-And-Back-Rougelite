import { useState } from 'react';
import { RELICS, RelicId } from '../../rogue/relics.js';

/** Collapsed-by-default satchel: a button that unfolds the relic list. */
export function RelicTray({ relics }: { relics: RelicId[] }) {
  const [open, setOpen] = useState(false);
  if (relics.length === 0) return null;
  return (
    <div className="relic-tray">
      <button className="btn relic-toggle" onClick={() => setOpen((o) => !o)}>
        🎒 Relics ({relics.length}) {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="relic-drop">
          {relics.map((id, i) => (
            <div key={`${id}-${i}`} className={`rogue-flavor tier-${RELICS[id].tier}`}>
              <b>{RELICS[id].name}</b> <span className="tier-chip">{RELICS[id].tier}</span> —{' '}
              {RELICS[id].effect}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
