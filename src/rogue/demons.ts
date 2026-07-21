/** The demon roster. Each demon warps one rule while seated (see quirk notes). */

export type DemonId = 'imp' | 'liar' | 'hoarder' | 'usurer' | 'adversary' | 'warden';

/** Personality nudges applied to the shared bot AI for every seat at this table. */
export interface BotStyle {
  /** added to the bid estimate (clamped to legal) */
  bidBias?: number;
  /** sometimes bids one off its estimate, on a whim */
  erratic?: boolean;
  /** sheds off-suit cards first, hoarding trumps */
  holdTrumps?: boolean;
  /** opens tricks with trumps when hunting */
  leadTrumps?: boolean;
}

export interface DemonDef {
  id: DemonId;
  name: string;
  flavor: string;
  /** a few words for target buttons and rosters */
  epithet: string;
  /** shown to the player before the hand so quirks are fair */
  quirk: string;
  /** how this demon's table plays its cards */
  style: BotStyle;
  /** earliest stop (0-based) this demon appears at */
  minStop: number;
}

export const DEMONS: Record<DemonId, DemonDef> = {
  imp: {
    id: 'imp',
    name: 'Imp',
    flavor: 'A petty spirit. It cheats at nothing, which around here is a kind of innocence.',
    epithet: 'a petty spirit',
    quirk: 'No quirk.',
    style: {},
    minStop: 0
  },
  liar: {
    id: 'liar',
    name: 'The Liar',
    flavor: 'Every word a hook, every silence a snare.',
    epithet: 'every word a hook',
    quirk: "Demons' bids stay hidden until the hand ends.",
    style: { erratic: true },
    minStop: 2
  },
  hoarder: {
    id: 'hoarder',
    name: 'The Hoarder',
    flavor: 'It counts what it takes and shows you nothing.',
    epithet: 'it keeps what it touches',
    quirk: "You can't see how many tricks the demons have taken.",
    style: { holdTrumps: true },
    minStop: 4
  },
  usurer: {
    id: 'usurer',
    name: 'The Usurer',
    flavor: 'All debts here compound.',
    epithet: 'all debts compound',
    quirk: 'Missed bids deal double damage to you at this table.',
    style: { bidBias: -1 },
    minStop: 6
  },
  adversary: {
    id: 'adversary',
    name: 'The Adversary',
    flavor: 'The bottom of the pit. The house always deals.',
    epithet: 'the house itself',
    quirk: 'The trump suit shifts every 3 tricks.',
    style: { bidBias: 1, leadTrumps: true },
    minStop: 9
  },
  /** The last gate: one card, no gimmick — just whatever the run built you into. */
  warden: {
    id: 'warden',
    name: 'The Warden',
    flavor: 'Not a jailer. A witness. It only ever asks whether you were ready.',
    epithet: 'asks if you were ready',
    quirk: 'No quirk, no hidden hand — one card, and the whole run behind it.',
    style: {},
    minStop: 18
  }
};

/** Demons eligible for a normal (non-boss) stop. */
export function demonPool(stopIndex: number): DemonId[] {
  return (Object.values(DEMONS) as DemonDef[])
    .filter((d) => d.id !== 'adversary' && d.minStop <= stopIndex)
    .map((d) => d.id);
}

/** Named minions who sit beside each lead demon, in seating order. */
const MINIONS: Record<DemonId, { name: string; epithet: string }[]> = {
  imp: [
    { name: 'Second Imp', epithet: 'copies the first, badly' },
    { name: 'Third Imp', epithet: 'bites' }
  ],
  liar: [
    { name: 'Echo', epithet: 'repeats what it heard you bid' },
    { name: 'Whisper', epithet: 'was never here' }
  ],
  hoarder: [
    { name: 'Magpie', epithet: 'steals the shiny ones' },
    { name: 'Rat', epithet: 'eats what falls' }
  ],
  usurer: [
    { name: 'The Clerk', epithet: 'keeps the books against you' },
    { name: 'The Collector', epithet: 'always arrives on time' }
  ],
  adversary: [
    { name: 'Left Hand', epithet: 'deals what the house wants' },
    { name: 'Right Hand', epithet: 'takes what the house is owed' }
  ],
  warden: [
    { name: 'The Witness', epithet: 'counts what you became' },
    { name: 'The Scale', epithet: 'weighs what you built' }
  ]
};

export interface DemonSeat {
  name: string;
  epithet: string;
  isLead: boolean;
}

/** The individual demons at a stop: the lead (quirk owner) first, then minions. */
export function rosterFor(stop: { demonId: DemonId; demonCount: number }): DemonSeat[] {
  const lead = DEMONS[stop.demonId];
  return [
    { name: lead.name, epithet: lead.epithet, isLead: true },
    ...MINIONS[stop.demonId]
      .slice(0, stop.demonCount - 1)
      .map((m) => ({ ...m, isLead: false }))
  ];
}
