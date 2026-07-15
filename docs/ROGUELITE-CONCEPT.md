# To Hell and Back: Roguelite — Concept

*Exploration branch for a single-player, run-based roguelite built on the existing
Oh Hell engine (`src/shared/engine.ts` + `src/shared/ai.ts`). **Direction decided
2026-07-15** (see Decisions at the bottom): this is its own product — it diverges from
`main` permanently and ships as a separate site, while the multiplayer Oh Hell game
stays where it is.*

## The pitch

You died. To get back, you play your way **down through the nine circles of hell and back
up through the spheres of heaven** — one hand of Oh Hell per stop. The deeper you go, the
crueler the table; the climb back up is where your earned powers shine. It's the game's
existing 1-up-and-back-down structure, literalized into a Dante-shaped run.

Balatro proved a solo card roguelite lives or dies on: (1) a tight core loop you already
want to replay, (2) run-warping items, (3) escalating stakes with rest stops. Oh Hell's
bid-exactly mechanic is a great core loop — tense, skill-forward, luck-textured.

## Run structure

```
DESCENT (hell)                          ASCENT (heaven)
Circle 1  · 1 card    vs 2 demons      Sphere 1 · 9 cards
Circle 2  · 2 cards                    Sphere 2 · 8 cards
   …           …                          …          …
Circle 9  · 9 cards   vs 3 demons      Sphere 9 · 1 card   → Paradise (win)
        └── THE BOTTOM: 10 cards, boss demon, special rules ──┘
```

- **One hand per stop** (not a full 19-hand game). A run that goes the distance is 19
  hands — same shape as the base game, new meaning.
- **Gate to advance**: make your bid to descend/ascend. Miss it and you lose **grace**
  (run health). Grace starts at 3; at 0 the run ends.
- **Every 3rd circle is a shop/rest**: spend souls (currency earned per made bid,
  scaled by bid size — bold bids pay more) on relics, or restore 1 grace.

## Opponents: demons with table quirks

Reuse `ai.ts` bots, but each demon warps one rule while it's seated:

| Demon | Quirk |
|---|---|
| The Glutton | Takes every tie (plays after you, wins rank ties) |
| The Hoarder | You can't see how many tricks it has taken |
| The Liar | Its bid is hidden until the hand ends |
| The Usurer | Missing your bid costs double grace here |
| The Tempter | Offers +2 souls if you bid one higher than you want |

Boss at the bottom: **The Adversary** — trump suit changes every 3 tricks.

## Relics (the run-warping layer)

Earned at circles, bought at shops. Examples, roughly sorted by power:

- **Loaded Die** — once per hand, see the trump card before bidding is locked.
- **Grave Ledger** — see a running count of played trumps.
- **Devil's Thumb** — once per hand, replay a card you just played (before the next player acts).
- **Halo (cracked)** — bids may miss by one, once per circle, without losing grace.
- **Ferryman's Coin** — skip a circle outright (consumed).
- **Sinner's Arithmetic** — hook rule applies to demons, never to you.
- **Second Soul** — +1 max grace.

Relics should bend *information* and *bid tolerance* first — the fun of Oh Hell is
judgment under uncertainty, so power = better information or softer punishment, not
"win tricks automatically."

## Scoring / meta

- Run score = souls banked + circles cleared + grace remaining.
- Unlocks between runs (new relics in the pool, new demons) — light meta-progression,
  no power creep across runs.
- Daily seed mode falls out for free: the engine already takes an injectable RNG
  (`Rng` in `engine.ts`), so a shared seed gives everyone the same deals/demons.

## What the engine already gives us

- `newGame` / `startNextHand` with configurable `maxHandSize` — per-stop hand sizes are
  just a config away.
- Injectable RNG for seeded runs (`shuffle(deck, rng)`).
- `legalBids` hook — demon quirks and relic effects are mostly bid/legality filters.
- Bots (`chooseBid` / `chooseCard`) as the demon baseline; quirks wrap these.

## What it needs that doesn't exist

- A **run state** wrapper above `GameState` (grace, souls, relics, current circle).
- Client screens: map (descent/ascent track), shop, relic tray, run summary.
- Single-player only at first — no server needed; the whole run can live client-side,
  which also means it works offline and costs nothing to host.

## Status (2026-07-15): playable vertical slice at `/run`

Built and verified (33 tests incl. headless full runs; driven end-to-end in a browser):

- **Core** (`src/rogue/`): seeded track builder, run state (grace/souls/relics/attempts),
  hand resolution with retry-on-miss, shops, all five launch relics, five demons.
- **Client** (`src/client/rogue/`): `useLocalHand` runs the engine + `ai.ts` demons fully
  in-browser on timers (no server); map / shop / hand / death / paradise screens; run
  persists in localStorage; region palettes (hell/bottom/heaven) as placeholder theming.
- **New base rule** (design call made during the build): in the roguelite the trump card
  stays **face-down while you bid** — the demons can see it, you can't. This is what makes
  information relics (Loaded Die) worth buying; the multiplayer game is unchanged.
- Launch demons: Imp (none), Liar (demon bids hidden), Hoarder (demon tricks hidden),
  Usurer (misses cost 2 grace), Adversary boss (trump shifts every 3 tricks).
- Numbers (all untuned first guesses): grace 3, souls = 3 + bid (+8 boss bounty),
  heal 6, relic costs 8–18, 2 demons at stops 1–6 then 3, shops after stops 3/6/9/12/15/18.

Not built yet: full theme art, meta-progression/unlocks, daily seed UI, more relics/demons,
sounds beyond the shared table set, mobile layout pass, standalone-site extraction.

## Decisions (2026-07-15)

The former open questions, answered:

1. **Pacing — one hand per stop.** 19 stops, ~25-minute runs. Grace absorbs the early
   variance: a missed 1-card bid at circle 1 costs 1 grace, so the coin-flippy openers
   are low-stakes warmup, and the iconic 1-card opener/closer stays.

2. **Relic axis — information is primary.** Most relics improve what you know (peek at
   trump, count played trumps, see demon bids). The bid-judgment core stays intact —
   you still have to be right, you're just better armed. Bid-tolerance relics
   (miss-by-one, grace shields) are the rare/legendary tier, never common.

3. **Art/tone — full theme swap.** New backgrounds, card backs, and UI chrome per
   region (hell / the bottom / heaven). A real art commitment, chosen deliberately
   because of #4: this is a standalone product, not a reskin of the multiplayer table.

4. **Positioning — the roguelite is the headline product, and a separate site.**
   It fully diverges from `main`, which remains the multiplayer Oh Hell game and keeps
   its SEO identity. Two sites at the end. This branch is the divergence point: shared
   engine code gets copied/extracted as needed, with no obligation to stay compatible
   with `main`.
