# Scoring — the chips × mult design

*How The Descent gets the Balatro feeling — a player-built machine making numbers
explode — without losing its identity as a trick-taking game. The first slice
(the core formula) shipped on the `infernal-arithmetic` branch; this doc holds the
design, the tuning notes, and the prioritized roadmap.*

## Why the old combat couldn't produce the feeling

A made bid dealt `5 + bid` damage: one additive axis, capped around 15, and no
purchase moved it much (Ember Brand was +3 flat). Balatro's dopamine loop comes from
a two-axis product — `chips × mult` — where the player assembles pieces that feed
both sides. One axis of additive bonuses can never explode; a product can.

## The formula

When you make your bid, the hand is **scored** (`src/rogue/scoring.ts`):

```
damage = (BASE_CHIPS + Σ rank of each winning card) × (1 + 0.5 × bid [+ relic mult])
```

- **Chips are trick quality.** Each trick you win adds the rank of the card that won
  it (2–14, judged against the trump suit in force at that trick — the Adversary's
  shifts count). Winning with an Ace is worth seven times winning with a 2, so *how*
  you make your bid matters, not just *that* you made it. This deepens the Oh Hell
  skill game instead of replacing it: trick quality is now a resource you manage
  against the risk of overtaking your bid.
- **Mult is boldness.** Bid 0 → ×1, bid 2 → ×2, bid 4 → ×3. `BASE_CHIPS = 10` keeps
  the made 0-bid alive (10 × 1) — the nil game stays a real line of play.
- **Relics feed the axes.** Ember Brand +1 mult, Pyre +1 mult per trump trick won,
  Zero's Crown ×3 on a made 0-bid, a Herald doubles chips for tricks won in its suit,
  Ledger of Wrath +4 chips per consecutive made bid. See "Engine relics" below.
- **Card enchantments feed chips too.** A Gilded card adds +6 chips when it wins a
  trick for you — the first slice of the persistent deck (see below).
- **Souls ride the machine**: `3 + damage/10` per made bid, so the economy grows with
  the engine instead of sitting flat.
- The miss side is scored the same way now — see "Enemy strike" below; it's no longer
  a flat surrogate.

**The design rule that keeps identity:** every future chips/mult source must key off
a trick-taking verb — winning tricks, trumps, suits, ducking, bid exactness — never a
passive "+X damage." Buying power should change how you play the cards.

## The wall (demon HP)

`demonMaxHpsFor` in `src/rogue/run.ts`. Hell climbs with depth (`16 + 7 × index`);
The Bottom spikes (130); heaven's raw totals *taper* (`195 − 9 × index`) because
shrinking hands score fewer chips — a smaller number is still a taller wall.
What actually climbs the whole run is **hands-to-clear**:

| leg | hands-to-clear (relic-less AI proxy) |
|---|---|
| Circles 1–9 | 1.3 → ~2.9 |
| The Bottom | ~3.6 (the peak) |
| Spheres 1–8 | 2.4 → ~4.4 |
| Sphere 9 | ~3.1 (victory lap) |

`src/rogue/pacing.test.ts` is the **headless probe** that holds this curve: it plays
bot-vs-bot hands at every stop, scores them through `scoreStrike`, and fails if any
gate takes more than 6 or fewer than 1 average hands. **Every future tuning change
(relics, enchantments, decks) goes through the probe before it ships.** Run with
`PACING_LOG=1` to print the table.

### Wall power scaling (shipped — closes the long-standing "retune heaven" TODO)

This section used to end with "note the proxy has no relics — as engine relics
land, retune heaven upward so a built machine is required, not optional," and
that never actually happened. It showed: a modest 3-relic build (Ember Brand,
Pyre, Zero's Crown) already cleared most gates in under 1 hand; a 5-relic build
dropped Sphere 9 — the stop with the *most* accumulated relics — to 0.4 hands,
below even Circle 1. Heaven's taper assumed relic-less play (shrinking hands
score fewer chips, so a smaller wall is still a proportionally tall one), but
relic bonuses are mostly flat and don't shrink with hand size, so the stop
where a run has the most power ended up with the *weakest* wall in the game.

A flat HP bump couldn't fix this: zero-relic and 5-relic damage output differ
by roughly an order of magnitude at a 1-card hand, and no single static number
is both small enough for a relic-less clear in ≤6 hands and large enough to
resist a stacked build. So the wall now scales with what the run has actually
built, not just stop index: `demonMaxHpsFor(stop, relics)` multiplies the
existing per-stop total by `wallPowerFactor(relics)` — `1 + 0.35` per
damage-relevant relic owned (Ember Brand, Pyre, Zero's Crown, a Herald,
Ledger of Wrath). With zero relics the factor is exactly 1, so the relic-less
curve above is untouched byte-for-byte — the existing probe still holds it.
`advance()` passes `run.relics` when it sets up the next gate; the client
passes it too so displayed max-HP bars match.

A second probe (`pacing.test.ts`, "a built machine still faces a real fight")
locks this in for a representative 3-relic build: still killable in under 6
hands everywhere, never a one-hit kill (>0.8 hands) anywhere. Real numbers,
3-relic build / 5-relic build, before → after:

| stop | before (5-relic hands) | after (5-relic hands) |
|---|---|---|
| Circle 1 | 0.2 | 0.5 |
| The Bottom | 1.3 | 3.5 |
| Sphere 9 (finale) | **0.4** | **1.0** |

**Known gap, stated plainly:** the factor only counts *relics*, not card
enchants (Gilded, Marked, a stacked suit of Heralds + matching cards, …) — a
heavily enchanted deck with few relics still under-taxes the wall. `0.35` per
relic is a first calibration, not a final one; it hasn't been checked against
a real multi-hour playtest, only the two sample loadouts above. Also capped
Ledger of Wrath's streak at 10 (`LEDGER_STREAK_CAP` in `scoring.ts`) — it
persists across the whole run and resets only on a miss, so without a cap a
long clean run snowballs its own chip bonus indefinitely.

## Presentation

The score-off in `BattleReport` (`src/client/rogue/HandView.tsx`) counts the strike
out loud: base chips land, each winning card ticks the chips up, the mult stamps in,
the total slams. Click to skip. The feel is ~40% presentation — protect it.

Table legibility, also in `HandView.tsx`:

- **"▸ next" chip** — a small tag on whoever acts (or leads) after the current
  turn, computed once (`nextSeat`) and covering bidding→dealer→leader and
  post-trick-collection→winner jumps, not just a flat rotation. Deliberately
  shows nothing when the current player is the trick's last to act — the winner
  isn't knowable until that card lands, and a guess would be worse than a blank.
- **Pre-selectable strike target** — click a living demon any time during the
  hand (not just after it resolves) to mark them; click again to change your
  mind. `HandView` owns the `target` state and passes it to `BattleReport` as
  `preselectedTarget`, which locks it in automatically the instant a made bid
  resolves (skipping the "choose where the blow lands" picker) as long as the
  marked demon is still standing — a demon felled earlier in the same multi-hand
  gate falls back to the picker, same as an unmarked hand always has.
- **Enchant visuals** — `CardView` (`src/client/components.tsx`) applies a
  `card-enchant-{id}` class straight off `card.enchant` for a colored
  border/glow, everywhere a card renders (hand, trick, deck browser, trump)
  — deliberately opaque to the component (it doesn't know what an enchant
  *means*, just that a distinct id gets a distinct look), keeping the shared
  card primitive decoupled from rogue-specific concepts. `enchantTitle()` in
  `scoring.ts` builds the hover tooltip text; callers that know what enchants
  mean (`HandView`, `DeckPickerModal`) supply it as `title`.

## Roadmap, ranked feel vs win

**Feel** = does it produce the number-go-up dopamine? **Win** = is it needed for
balance/completability? ● strong · ◐ some · ○ little.

| Item | Feel | Win | Priority | Status |
|---|---|---|---|---|
| Chips × mult strike formula | ● | ● | P0 | ✅ shipped |
| Score-off animation in BattleReport | ● | ○ | P0 | ✅ shipped (v1 — sound & bigger slam later) |
| Demon HP curve by stop index + pacing probe | ○ | ● | P1 | ✅ shipped |
| Souls ride damage | ◐ | ◐ | P1 | ✅ shipped |
| Engine relics (Pyre, Zero's Crown, Heralds, Ledger of Wrath) | ● | ◐ | P2 | ✅ shipped |
| Persistent player deck + Gilded card enchantment | ● | ◐ | P2 | ✅ shipped (first enchant only) |
| Demon strike: score damage taken from demon trick wins | ◐ | ● | P2 | ✅ shipped |
| Reliquary: +1 max HP per demon felled (companion to the above) | ○ | ● | P2 | ✅ shipped |
| Cracked Halo rework: 1 charge per gate, not unlimited passive | ○ | ● | P1 | ✅ shipped |
| Trump Anchor consumable (lock trump, chosen suit, one hand) | ● | ◐ | P2 | ✅ shipped |
| Sphere 9 finale: the Warden (named demon, no HP retune) | ● | ○ | P2 | ✅ shipped |
| Demon corruption of cards / shop cleanse | ◐ | ○ | P3 | ✅ shipped |
| Shop Pacts (packs): enchant / destroy / duplicate a card | ◐ | ◐ | P3 | ✅ shipped |
| More enchant types (Royal, Blazing, Marked) | ◐ | ○ | P3 | ✅ shipped |
| Starting decks: Standard, Gambler's, Ashen | ◐ | ○ | P3 | ✅ shipped (3 of the DECKS.md brainstorm) |
| Pre-selectable strike target during the hand | ◐ | ○ | — | ✅ shipped |
| "Next to act" turn indicator | ○ | ○ | — | ✅ shipped |
| On-card enchant styling + hover tooltips | ◐ | ○ | — | ✅ shipped |
| Wall power scaling: HP scales with damage relics owned | ○ | ● | P1 | ✅ shipped |
| Ledger of Wrath streak cap (stop the snowball) | ○ | ◐ | P2 | ✅ shipped |
| Relic-count badges (×N) in the tray and use-buttons | ○ | ○ | — | ✅ shipped |

### Engine relics (shipped)

Each keyed to a trick-taking verb, in `src/rogue/scoring.ts` + `src/rogue/relics.ts`:

- **Pyre** — +1 mult per trump trick *you win* this hand (reads `TrickWin.trump`,
  reworded from "played" to "won" so it needs no extra plumbing beyond what
  `scoreStrike` already receives).
- **Zero's Crown** — a made 0-bid strikes at ×3 instead of ×1 (stacks with Ember
  Brand's +1 on top).
- **Herald of $Suit** (one per suit) — tricks you win in that suit score double
  chips.
- **Ledger of Wrath** — +4 chips per consecutive made bid (this one included),
  reset on any miss. `RunState.madeStreak` tracks it; persists across gates, only
  a miss breaks it.
- **Reliquary** — +1 max HP, permanently, every time you fell a demon. The first
  lever that raises `PLAYER_MAX_HP` (14, fixed) beyond the flat `FELL_HEAL`/Ashen
  Shield defense lane.

### Persistent deck + enchantments (shipped)

`RunState.deck: Card[]` is a real 52-card deck (`buildDeck()`) carried for the whole
run; `startNextHand()` (`src/shared/engine.ts`) now takes an optional `deck` param
so it reshuffles *that* deck instead of building a fresh standard one every hand —
same shared-draw Oh Hell shape (everyone still deals from the same 52), but any
enchantment tag on a card rides along wherever it's dealt, to you or a demon.

Five enchants, all in `src/rogue/scoring.ts`'s `ENCHANTMENTS` registry:

- **Gilded** — +6 chips on a trick win.
- **Royal** — counts as an Ace (rank 14) for chips on a trick win.
- **Blazing** — always counts as a trump win (feeds Pyre).
- **Marked** — +0.5 mult on a trick win — the one enchant that pushes the *mult*
  axis instead of chips, so deck-building gets a real two-axis choice.
- **Cursed** — the negative one; see "Demon corruption" below.

Acquisition: **Embered Pact** (cheap, instant, random unenchanted card, Gilded
only — unchanged from the first slice) or **Pact of Sealing** (pricier, held until
used, lets you choose both the card *and* which of the four positive enchants to
seal in). Both go through `enchantCard()` in `run.ts`.

### Shop Pacts (shipped)

Three consumable relics, each spent from the map (not mid-hand — deck edits between
fights, not during one) via a card-picker modal (`DeckPickerModal.tsx`):

- **Pact of Sealing** (`usePactSeal`) — choose an unenchanted card and an enchant
  to seal into it.
- **Pact of Ruin** (`usePactRuin`) — choose any card and burn it out of the deck
  permanently. Safe to do: `startNextHand` only needs `deck.length` cards to cover
  the biggest gate's demand, so `MIN_DECK_SIZE = 4 seats × 10-card Bottom hand + 1
  trump = 41` is the floor `destroyCard()` enforces — well short of shrinking the
  deck into an actual dealing failure.
- **Pact of Echoes** (`usePactEcho`) — choose any card and add an exact duplicate
  (a fresh id, same suit/rank/enchant) to the deck, capped at `MAX_DECK_SIZE = 60`.

Each wraps `consumeRelic()` (spends the held relic) around the underlying pure deck
mutator (`enchantCard` / `destroyCard` / `duplicateCard`), so the mutator itself
stays reusable outside the pact flow.

**Balance note, stated plainly:** neither Ruin nor Echo has been run back through
`pacing.test.ts` — the probe holds the *demon* HP/damage curves, not the player's
own deck composition, and a duplicated Ace or a thinned-out low-card tail changes
average chip output in ways the probe doesn't see yet. Treat both as a real but
not-fully-tuned lever, the same caveat the doc already carries for engine relics
("the proxy has no relics — retune heaven as they land").

### Demon corruption / shop cleanse (shipped)

Demons scar the deck on the way down: clearing a **hell** stop (`advance()` in
`run.ts`) rolls a seeded `CORRUPTION_CHANCE = 0.35` chance to curse one random
unenchanted card — `applyCorruption()`. A Cursed card is a genuine liability, and
deliberately hits both sides of the table it plays at:

- **-4 chips** (floored at 0) when *you* win a trick with it (`scoreStrike`).
- **+0.3 demon mult** when a *demon* wins a trick with it instead
  (`scoreDemonStrike`) — leaving a curse in isn't just weaker offense, it's a
  sharper counter-strike.

Shops sell a **cleanse** (`cleanseCard()`, `CLEANSE_COST = 8` souls) that lifts a
chosen curse — the section only appears in `ShopView` when a cursed card actually
exists in the deck. Corruption never touches an already-enchanted card (one mark
per card, same rule Pact of Sealing follows).

### Starting decks (shipped, 3 of the DECKS.md brainstorm)

`src/rogue/decks.ts` (new), picked at the home screen before the run seeds:

- **Standard Deck** — the baseline, no changes (default).
- **Gambler's Deck** — 12 starting souls, max grace 2 (down from 3).
- **Ashen Deck** — starts with Ember Brand + Ashen Shield, max HP 10 (down from 14).

All three are pure `RunState` config (`DeckDef.startRelics` / `maxGrace` / `maxHp` /
`startSouls`) — no deck-*composition* changes, deliberately. DECKS.md's own Stripped
Deck sketch (36 cards, ranks 6–14 only) is short of `MIN_DECK_SIZE` (41) and would
crash dealing at The Bottom's 4-seat 10-card hand; it needs a rework (strip fewer
ranks, or shrink the boss table) before it can ship. Two-Headed and the other
`deckBuild`-flavored decks stay later work for the same reason — this slice only
shipped the decks that are pure config.

### Enemy strike: scoring the miss side (shipped)

`missDamage()` is gone. `scoreDemonStrike()` in `src/rogue/scoring.ts` mirrors your
own strike formula, fed by what actually happened at the table:

```
demonDamage = (DEMON_BASE_CHIPS + count of tricks the demons won this hand) × demonMult
demonMult   = min(DEMON_MULT_CAP, 1 + DEMON_MULT_PER_MISS × |bid − taken|)
```

Tuned constants: `DEMON_BASE_CHIPS = 2`, `DEMON_MULT_PER_MISS = 0.2`,
`DEMON_MULT_CAP = 2.5`. Chips deliberately count tricks, not summed rank — player
HP (~14, now +1 per Reliquary fell) is a small, tightly-bounded resource, unlike
demon HP pools (16–195) built to absorb the big chips×mult numbers on your side of
the table. Mult comes from *how badly you missed* (not your bid) — a close call
stings less than a wild overbid, a different axis than your own boldness-driven
mult. Fires only on a player miss, same as before; the Usurer's double and Ashen
Shield's flat −2 still layer on top. Cracked Halo now gates on
`RunState.crackedHaloCharges` (1 per gate, refills on `advance()`) instead of an
unlimited passive — see the relic rework above.

Data plumbing: `winsFor()` in `src/client/rogue/useLocalHand.ts` filters
`GameState.trickLog` by winner predicate, covering both the player's wins and the
demons' collective wins from the same helper; `resolveHand()`'s `outcome.demonWins`
carries the demon side through.

`src/rogue/pacing.test.ts` now runs a second probe, `meanMissDamage`, holding the
miss-damage curve sane the same way `meanDamage` holds the strike curve — average
miss damage stays above 1 and below `PLAYER_MAX_HP` at every stop (empirically it
peaks around 11.6 at The Bottom against 14 max HP, comfortable headroom against a
one-hit kill without going toothless).

### Sphere 9: the Warden (shipped)

The last stop was already a 1-card hand by construction (`STOP_COUNT − index`), but
it rolled a random demon from the pool and heaven's HP taper made it the softest
fight in the back half — a "victory lap," not a finale. `buildTrack()` now hardcodes
stop 18's `demonId` to a new fixed demon, **the Warden** (`src/rogue/demons.ts`): no
mechanical quirk, no HP retune — the point is a deliberate, named capstone for
"you vs. whatever you built," not a harder fight. The Adversary (stop 9, The
Bottom) stays the mechanical/HP peak of the run.

### Trump Anchor (shipped)

A consumable relic (`rare`, 16 souls): once per hand, pick a suit and lock trump to
it for the rest of that hand, overriding even the Adversary's shift. Deliberately
unbanned against the Adversary — the single-hand scope already bounds it (a gate
against the Adversary replays several hands; spending a scarce consumable wins you
one of them, not the fight), and reaching the table with the resource and the read
to spend it well is itself the reward for building around a suit.

Engine side: `useLocalHand`'s trump-shift effect now checks a `trumpLocked` ref
before rolling the Adversary's shift. UI: a small suit picker in `HandView`
(reuses the existing bid-picker styling) calls `hand.lockTrump(suit)` and
`onConsumeRelic('trumpAnchor')` — the latter is new plumbing (`consumeRelic()` in
`run.ts`) for relics spent *during* a hand, where the battle lives in local
component state until it resolves.

## Data plumbing (for future slices)

- `GameState.trickLog` (engine) records every collected trick: cards, winner, and
  the trump suit in force. Anything that scores "what happened during the hand"
  reads from here.
- `useLocalHand` distills both sides' `TrickWin[]` (`winsFor()`, one predicate,
  two callers) and passes them through `result` → `BattleReport.resolve()` →
  `resolveHand()` → `scoreStrike()` / `scoreDemonStrike()`.
- `RunState.lastHand.score` / `.demonScore` carry the full breakdown for the UI —
  the miss-side `ScoreOff`-style animation for `demonScore` is still TODO;
  today only the made-bid strike gets the full score-off treatment.
- `RunState.deck` carries card enchantments as `Card.enchant` (opaque string in
  `shared/types.ts`, typed as `EnchantId` in `scoring.ts`); `TrickWin.enchant`
  rides along automatically since the winning trick's `Card` object came from
  that same deck.
