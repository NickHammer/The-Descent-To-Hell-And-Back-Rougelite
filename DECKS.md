# Decks — design brainstorm

*Balatro-style starting decks for The Descent: pick a deck at the gate, and the whole
run bends around it. Nothing here is implemented yet — this doc is the thinking space.
The scoring engine decks will plug into (chips × mult, and the roadmap that ranks
decks against the other systems) lives in [`docs/SCORING.md`](docs/SCORING.md).*

## What a deck can legally touch

Ordered from trivial to expensive, given the current architecture:

| Lever | Where it lives | Difficulty |
|---|---|---|
| Starting relics | `newRun()` in `src/rogue/run.ts` seeds `relics` | trivial |
| Grace / HP / souls economy | exported constants + `RunState` init | trivial |
| Shop behavior (prices, slots, heal cost) | `shopStock()` / `buyRelic()` / `HEAL_COST` | easy |
| Damage formulas (per-deck modifiers) | `resolveHand()` / `missDamage()` | easy |
| Trump behavior (blind thresholds, shifts) | `isTrumpBlind()` + `useLocalHand` driver | moderate |
| **Deck composition** (strip ranks, add cards) | `src/shared/engine.ts` builds a fixed 52-card deck at deal time | **needs engine work** — the one real lift |

Deck composition is the flashiest lever (it changes how every hand *feels*) and the only
one that touches the engine. Everything else is run-layer configuration.

## The decks

### Standard Deck
The baseline 52. What the game is today. *(trivial — it's the default)*

### Stripped Deck
**Hook:** the pit burned the small cards.
No 2s–5s — a 36-card deck. Every card is a threat, bids inflate, sloughing safely gets
hard. Souls per made bid +1 to reward the sharper knife-edge. *(needs engine work)*

### Gambler's Deck
**Hook:** you arrived in debt.
Start with 12 souls and −1 max grace (2 total). Buy your safety early or die fast.
*(trivial)*

### Martyr's Deck
**Hook:** one life, lived loudly.
1 max grace — but made bids pay double souls and felling a demon heals 4. All knife,
no net. *(trivial)*

### Blind Deck
**Hook:** the light never comes back.
The trump is face-down while bidding at **every** hand size, not just 4+. Made bids
strike +2 harder. Loaded Die is banned from pools (it would trivialize the identity).
*(easy)*

### Saint's Deck
**Hook:** you kept your halo, and the pit resents it.
Start with the Cracked Halo (legendary). Shop prices +50%, and shops never restock it
for the rest of the run. *(easy)*

### Hoarder's Deck
**Hook:** the shop knows you.
Shops offer 4 relics instead of 3, and prices −2. Healing grace costs double. Greed as
a build style. *(easy)*

### Coward's Deck
**Hook:** you know the ferryman by name.
Start with two Ferryman's Coins. The Adversary has +10 HP — you can dodge the road, but
the bottom collects the toll. *(trivial)*

### Ashen Deck
**Hook:** already burned once.
Start with Ember Brand and Ashen Shield; max HP 10. Aggressive and brittle. *(trivial)*

### Devil's Deck
**Hook:** information wants a price, and you've already paid it.
Information relics (Loaded Die, Grave Ledger, Devil's Lettuce, Trump Vision) cost half.
Grace can never be healed — not at shops, not by Second Soul. *(easy)*

### Two-Headed Deck *(wilder — needs engine work)*
**Hook:** every card has a twin.
Two copies of each card in a 7-A deck (32 unique → 64 cards? or 26 unique doubled).
Ties become common; a "second copy wins the tie" rule replaces rank ties. Changes trick
resolution — the deepest cut in this list, and the most novel.

## Implementation sketch (when the time comes)

```ts
// src/rogue/decks.ts
export interface DeckDef {
  id: DeckId;
  name: string;
  hook: string;           // one-line flavor
  startRelics: RelicId[];
  maxGrace?: number;      // default 3
  maxHp?: number;         // default PLAYER_MAX_HP
  startSouls?: number;
  soulsMult?: number;     // made-bid payout multiplier
  shopPriceMult?: number;
  shopSlots?: number;     // default 3
  healable?: boolean;     // Devil's Deck: false
  alwaysBlind?: boolean;  // Blind Deck
  bannedRelics?: RelicId[];
  deckBuild?: 'standard' | 'stripped' | 'doubled'; // engine hook, later
}
```

- `newRun(seed, deck)` applies the run-layer fields; `RunState` records `deckId` so
  saves survive and the end screen can name the deck.
- Deck picker becomes a pre-gift phase (`phase: 'deck'`) or lives on the home screen
  next to "Begin the descent" — home screen feels right for Balatro parity.
- `deckBuild` threads through `useLocalHand` → `newGame` options → a `buildDeck()`
  hook in `src/shared/engine.ts` (today the 52 cards are constructed inline at deal).
- Unlocks (later): decks unlock via achievements — win a run (Gambler's), win without
  healing (Martyr's), fell the Adversary before any minion (Coward's), etc.

## Open questions

- Should decks change demon rosters/quirks, or stay purely on the player's side?
- Does the seeded gift interact with `startRelics` (skip the gift? smaller gift)?
- Balance note from the battle-model work: table thinning already swings difficulty;
  deck modifiers should be tested through the headless probe before shipping.
