/** The demon roster. Each demon warps one rule while seated (see quirk notes). */

export type DemonId = 'imp' | 'liar' | 'hoarder' | 'usurer' | 'adversary';

export interface DemonDef {
  id: DemonId;
  name: string;
  flavor: string;
  /** shown to the player before the hand so quirks are fair */
  quirk: string;
  /** earliest stop (0-based) this demon appears at */
  minStop: number;
}

export const DEMONS: Record<DemonId, DemonDef> = {
  imp: {
    id: 'imp',
    name: 'Imp',
    flavor: 'A petty spirit. It cheats at nothing, which around here is a kind of innocence.',
    quirk: 'No quirk.',
    minStop: 0
  },
  liar: {
    id: 'liar',
    name: 'The Liar',
    flavor: 'Every word a hook, every silence a snare.',
    quirk: "Demons' bids stay hidden until the hand ends.",
    minStop: 2
  },
  hoarder: {
    id: 'hoarder',
    name: 'The Hoarder',
    flavor: 'It counts what it takes and shows you nothing.',
    quirk: "You can't see how many tricks the demons have taken.",
    minStop: 4
  },
  usurer: {
    id: 'usurer',
    name: 'The Usurer',
    flavor: 'All debts here compound.',
    quirk: 'Missed bids deal double damage to you at this table.',
    minStop: 6
  },
  adversary: {
    id: 'adversary',
    name: 'The Adversary',
    flavor: 'The bottom of the pit. The house always deals.',
    quirk: 'The trump suit shifts every 3 tricks.',
    minStop: 9
  }
};

/** Demons eligible for a normal (non-boss) stop. */
export function demonPool(stopIndex: number): DemonId[] {
  return (Object.values(DEMONS) as DemonDef[])
    .filter((d) => d.id !== 'adversary' && d.minStop <= stopIndex)
    .map((d) => d.id);
}
