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

- **19 stops**, one hand of Oh Hell each: hand sizes climb 1→10 on the way down, then
  shrink 10→1 on the way back up.
- **Make your bid exactly to advance.** Miss it and you lose 1 **grace** and replay the
  stop. Grace starts at 3; at 0 the run ends.
- **Souls** are the run currency: 3 + your bid per made bid (bold bids pay more), plus a
  bounty for beating the boss. A **shop** opens every third stop — spend souls on relics
  or restore 1 grace.
- **The gift at the gate**: every run opens with a choice of 1 of 3 relics, and an
  information relic is always among them.
- **The light fails as you descend**: on hands of 4+ cards the trump card stays face-down
  while you bid. The demons can see it. Small hands play fair.
- Runs are seeded — the track, demons, gift, and shops are deterministic per seed.

### The demons

Each stop seats 2–3 demons (the shared bot AI), and each demon warps one table rule.
Quirks are always shown before the hand.

| Demon | Quirk |
|---|---|
| Imp | None. A kind of innocence, around here. |
| The Liar | Demons' bids stay hidden until the hand ends. |
| The Hoarder | You can't see how many tricks the demons have taken. |
| The Usurer | Missing your bid costs 2 grace at this table. |
| The Adversary (boss) | The trump suit shifts every 3 tricks. |

### The relics

Information is the primary power axis; bid-tolerance is the rare tier.

| Relic | Effect |
|---|---|
| Loaded Die | See the trump while bidding on deep hands (4+ cards). |
| Grave Ledger | Running count of trumps played this hand. |
| Second Soul | +1 max grace, and restores 1 grace when taken. |
| Cracked Halo | Missing by exactly one costs no grace (but earns no souls). |
| Ferryman's Coin | Skip a stop outright (consumed; not past the Adversary). |

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
