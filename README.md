# The Descent

A solo roguelite card game built on [Oh Hell](https://www.trickstercards.com/help/oh-hell/).
You died. To get back, you play your way down through the nine circles of hell and up
through the spheres of heaven — one hand of cards at every gate. Free, in your browser,
entirely client-side.

## The run

```
DESCENT (hell)                          ASCENT (heaven)
Circle 1  · 1 card                      Sphere 1 · 9 cards
Circle 2  · 2 cards                     Sphere 2 · 8 cards
   …           …                           …          …
Circle 9  · 9 cards                     Sphere 9 · 1 card   → Paradise (win)
        └── THE BOTTOM: 10 cards, boss demon ──┘
```

- **19 stops**, each a **battle**: hand sizes climb 1→10 on the way down, then shrink
  10→1 on the way back up, and hands of Oh Hell repeat at each gate until one side falls.
- **Every demon at the table has its own HP** — a lead demon (the quirk owner) carries
  half the table's total, its named minions split the rest. Make your bid exactly and
  the hand is **scored**: `(10 + the rank of each card you won a trick with) × (1 +
  bid/2)` damage at **a demon of your choosing** — win big tricks on bold bids and the
  number explodes. A demon at 0 HP leaves the table (a bite of its soul restores 2 HP),
  and killing the lead lifts its quirk. The gate opens when every demon is down.
- **Miss and the table strikes back** — scored the same way in reverse: `(2 + tricks
  the demons won) × (1 + 0.2 × how badly you missed by)` damage to you. A close call
  stings less than a wild overbid.
- **You have 14 HP**, refilled at each new gate. At 0 HP, **grace** catches you: lose
  1 grace, return at full health, and the demons keep their wounds. Grace starts at 3;
  at 0 the run ends.
- **Souls** are the run currency: 3 + a tenth of the damage you dealt per made bid
  (a harder blow shakes more loose), plus a bounty for felling the boss. A **shop** opens every third stop — spend souls on relics
  or restore 1 grace.
- **The gift at the gate**: every run opens with a choice of 1 of 3 relics, and an
  information relic is always among them.
- **The light fails as you descend**: on hands of 4+ cards the trump card stays face-down
  while you bid. The demons can see it. Small hands play fair.
- Runs are seeded — the track, demons, gift, and shops are deterministic per seed.

### The demons

Each stop seats 2–3 demons: a lead with the table's quirk and a personality (a play-style
bias on the shared bot AI), plus named minions (Echo, Magpie, The Clerk…). Quirks are
always shown before the hand, and both the quirk and the personality die with the lead.

| Demon | Quirk | Personality |
|---|---|---|
| Imp | None. A kind of innocence, around here. | Plays it straight. |
| The Liar | Demons' bids stay hidden until the hand ends. | Erratic — sometimes bids off its own count. |
| The Hoarder | You can't see how many tricks the demons have taken. | Hoards trumps, sheds everything else first. |
| The Usurer | Missed bids deal double damage to you at this table. | Bids conservatively and waits for you to slip. |
| The Adversary (boss) | The trump suit shifts every 3 tricks. | Overbids and leads with trumps. |

### The relics

Information is the primary power axis; bid-tolerance is the rare tier.

Rarity is color-coded in game: common **blue**, uncommon **purple**, rare **green**,
legendary **orange**.

| Relic | Rarity | Effect |
|---|---|---|
| Loaded Die | common | See the trump while bidding on deep hands (4+ cards). |
| Grave Ledger | common | Running count of trumps played this hand. |
| Second Soul | uncommon | +1 max grace, and restores 1 grace when taken. |
| Ember Brand | uncommon | Made bids strike with +1 mult. |
| Ashen Shield | uncommon | Missed bids deal 2 less damage to you (never below 1). |
| Trump Vision | uncommon | Demons' trumps smolder through the backs of their cards. |
| 🥬 The Devil's Lettuce | rare | Smoke curls from the backs of demons' high cards (Q, K, A). |
| Ferryman's Coin | uncommon | Skip a stop outright (consumed; not past the Adversary). |
| Cracked Halo | legendary | Missing by exactly one deals no damage either way. |

The full design rationale — and the decisions behind it — lives in
[`docs/ROGUELITE-CONCEPT.md`](docs/ROGUELITE-CONCEPT.md).

## Running it

```
npm install
npm run dev       # hot reload at http://localhost:5173
```

Production build:

```
npm run build     # outputs dist/
npm run preview   # serve the built site locally
```

## Deploying

The whole game runs client-side, so it deploys as a **static site** — no server, no
database. `render.yaml` is a ready-made [Render](https://render.com) blueprint
(New → Blueprint → point it at this repo): it builds with `npm ci && npm run build`,
publishes `dist/`, and rewrites every path to `index.html` for SPA routing. Any static
host with an SPA fallback works the same way.

## Project layout

- `src/shared/` — the Oh Hell engine (pure TypeScript, no dependencies): dealing,
  bidding, trick resolution, and the bot AI that plays the demons. Fully unit-tested.
- `src/rogue/` — run logic (pure, seeded, no DOM): the 19-stop track, grace, souls,
  relics, demons, shops. Fully unit-tested.
- `src/client/` — React UI: the run map, shops, and the hand view, which drives each
  hand entirely in the browser via `rogue/useLocalHand.ts`.
- `docs/ROGUELITE-CONCEPT.md` — the concept doc this game grew from.

## Checks

```
npm test      # engine + run-logic unit tests
npm run sim   # 600 headless bot games through the engine, asserts no rule violations
```

## Lineage

The Descent began as a branch of a multiplayer Oh Hell game (shared table screen,
phones as private hands) and split off as its own product in July 2026. The multiplayer
game lives on in its original repo; this one carries only the engine they share.
