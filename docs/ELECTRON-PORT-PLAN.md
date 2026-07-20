# Electron Port Plan

Goal: ship The Descent as a standalone desktop app (Windows first) while keeping the
existing web build (Render deploy via `render.yaml`) working from the same codebase.

## Why this is a good fit

The game is fully client-side: Vite + React, saves in `localStorage`
(`src/client/rogue/RunApp.tsx`), audio in `public/sounds`, no network calls. Electron
just needs to host the built `dist/` output in a window — no backend to port.

## Architecture

```
electron/
  main.ts       # main process: create BrowserWindow, load dist/index.html or dev server
  preload.ts    # contextBridge API (only if/when we need native features)
src/            # unchanged — renderer is the existing app
dist/           # vite build output, loaded by Electron in production
```

- **Dev:** Electron loads `http://localhost:5173` (the Vite dev server) so HMR keeps working.
- **Prod:** Electron loads `dist/index.html` from disk.
- Keep the renderer sandboxed: `contextIsolation: true`, `nodeIntegration: false`. The
  game needs no Node APIs in the renderer today, so the preload can start empty.

## Steps

### 1. Scaffolding — DONE
- [x] Add dev deps: `electron` (^43), `electron-builder`, `concurrently`, `wait-on`,
      `cross-env`. Electron ≥40.10.3 needs Node ≥22.12 to install (ESM-only
      `@electron/get`); this machine runs Node 22.23.1 (upgraded via winget 2026-07-19).
- [x] `electron/main.cts` (window creation, dev/prod URL switch, auto-hidden menu bar).
- [x] `electron/preload.cts` (empty contextBridge stub for now).
- [x] `tsconfig.electron.json` compiles `.cts` → `dist-electron/*.cjs` (CommonJS output
      sidesteps the root `"type": "module"` clash).

### 2. Vite config changes — DONE
- [x] `base: './'` in `vite.config.ts`. Verified `npm run build` output uses `./assets/...`.
- [x] `src/client/sounds.ts` now builds paths from `import.meta.env.BASE_URL`; verified
      audio loads under `file://` in Electron (`canplaythrough` fired).

### 3. Scripts (`package.json`) — DONE
- [x] `electron:dev` — Vite dev server + Electron together (concurrently + wait-on).
- [x] `electron:build` — `vite build` + `electron:compile` then `electron-builder` (NSIS).
- [x] `dev`, `build`, `test`, `sim` unchanged for the web workflow (44/44 tests pass).

**Verified 2026-07-19:** production-mode Electron (`dist-electron/main.cjs` loading
`dist/index.html`) launches, renders the title screen, advances through "Begin the
descent" to the relic pick, and resolves sound files — driven via Playwright `_electron`.

### 4. Desktop polish
- [ ] Window: sensible default size (game is viewport-scaled — check `index.html`
      viewport meta and CSS for fixed assumptions), min size, remembered bounds.
- [ ] App icon (`build/icon.ico`) and product name in `electron-builder` config.
- [ ] Strip the default menu bar; add F11 fullscreen toggle and Ctrl+Shift+I only in dev.
- [ ] Disable browser zoom/pinch if it breaks layout.

### 5. Saves
- `localStorage` works in Electron and persists under the app's user-data dir, so the
  existing save system (`thab_*` keys) works with **zero changes** for v1.
- [ ] Later (optional): move saves to JSON files in `app.getPath('userData')` via IPC,
      enabling save export/backup. Requires a one-time localStorage → file migration.

### 6. Packaging & release
- [ ] `electron-builder` config: Windows NSIS target first; mac/linux later if wanted.
- [ ] Verify the packaged app offline: launch, sounds play, save/resume a run, admin
      buttons still work.
- [ ] Decide distribution: GitHub Releases artifacts (simplest) vs. itch.io.
- [ ] Code signing: skip for v1 (SmartScreen warning is acceptable), revisit if
      distributing widely.

### 7. Optional follow-ups
- Auto-update via `electron-updater` + GitHub Releases.
- Steam packaging (steamworks.js) if the game heads that direction.
- Rich presence / achievements — needs the preload IPC layer from step 5.

## Risks / gotchas

| Risk | Mitigation |
| --- | --- |
| `file://` breaks absolute asset paths | ~~done~~ `base: './'` + `BASE_URL` sound paths, verified in Electron |
| ESM project vs Electron main-process module format | ~~done~~ `.cts` sources emit `.cjs` via `tsconfig.electron.json` |
| Web deploy regression from shared config | `npm run build` verified; still confirm on Render after first deploy |
| Electron install needs Node ≥22.12 | Node upgraded to 22.23.1; if the binary is missing after `npm ci`, run `node node_modules/electron/install.js` |
| Audio autoplay policy differences | Electron is permissive by default; verify first-interaction unlock logic in `sounds.ts` still behaves |

## Definition of done (v1)

Double-clickable Windows installer produces an app that runs the full game offline,
persists runs across restarts, and the web build still deploys unchanged.
