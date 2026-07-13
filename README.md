# To Hell and Back

An [Oh Hell](https://www.trickstercards.com/help/oh-hell/) card game for 2–4 players — play
solo against bots, or with friends where everyone's phone is their private hand.

## Rules

- 19 hands: 1 card each, up to 10, and back down to 1. The deck is reshuffled every hand.
- After the deal, one card is flipped to set the **trump suit**.
- Starting left of the dealer (dealer bids last), each player **bids** how many tricks they'll take.
- You must **follow the led suit** if you can; otherwise play a trump to win or slough anything.
- The highest trump wins the trick, or the highest card of the led suit if no trump was played.
- **Scoring:** make your bid exactly and score **bid + 5**; miss it (over or under) and score
  **−(bid + 5)**. Bid 3 and make it: +8. Bid 2 and miss: −7.
- **Hook rule** (optional, on by default): on the back half only (the 9-card hand after the
  peak, down to the final 1-card hand), the dealer — who always bids last — may not bid an
  amount that makes total bids equal the tricks available, so someone is always set to fail.
  On the way up (1 through 10), everyone bids freely.

## Running it

```
npm install
npm run build     # build the client (once, or after client changes)
npm start         # serve everything at http://localhost:8080
```

For development with hot reload: `npm run dev`, then open http://localhost:5173.

> **Windows note:** the first time the server runs, allow Node.js through the firewall
> (private networks) so phones on your Wi-Fi can connect.

## How to play

**Solo vs bots** — open the site, enter your name, create a game with
"I'm playing on this device" checked, add bots, deal.

**2+ players, one household** — on the shared screen (PC/TV), create a game with
"I'm playing on this device" **unchecked** — that screen becomes the table display.
Each player scans the QR code with their phone (same Wi-Fi) and gets a private hand.
The shared screen shows the trick, trump, bids, and scores.

**Mixed** — play on the PC yourself and have others join by phone; bots fill any leftover seats.

Phones can lock or refresh freely — the seat is reclaimed automatically on reconnect.

## Project layout

- `src/shared/` — game engine (pure TypeScript, no dependencies): rules, dealing, bidding,
  trick resolution, scoring, and the bot AI. Fully unit-tested.
- `src/server/` — Node + Express + WebSocket server. Owns the authoritative game state;
  clients only ever see their own cards.
- `src/client/` — React UI: home / lobby (QR joining) / game table.
- `scripts/e2e.ts` — end-to-end test that plays a full game through the live server.

## Checks

```
npm test     # engine unit tests
npm run sim  # 600 headless bot games, asserts no rule violations
npm run e2e  # full game over WebSocket (server must be running; set TRICK_PAUSE_MS=30 BOT_THINK_MS=20 for speed)
```

## Roadmap

- **Online play over the internet:** the architecture is already client/server, so this is
  a deployment step — host the server (Fly.io, Render, etc.) and share the room code.
