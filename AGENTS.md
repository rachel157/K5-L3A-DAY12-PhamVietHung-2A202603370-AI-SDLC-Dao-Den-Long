# Đảo Đèn Lồng — Agent Guidelines

Game 3D + chế độ headless deterministic (`TypeScript` + `Vite` + `Three.js` + Node `^20.19.0 || >=22.12.0`; compiled `dist-cli/` runs on Node 18+).

## Commands
- `npm install` — install dependencies
- `npm run build` — compile CLI (`dist-cli/`) and web (`dist/`)
- `npm test` — compile CLI/core/settings and run `node --test`
- `npm run headless` — run headless CLI (`node dist-cli/cli/headless.js`, Contract `v1.3`, `--night 1|2|3`)
- `npm run dev` / `node dist-cli/cli/run.js` — run 3D web app locally (with disk leaderboard)
- `node dist-cli/cli/bench.js --seed 42 --duration 30 --out bench.json` — 1280×720 WebGL benchmark
- `node dist-cli/cli/soak.js --seed 7 --nights 10 --out soak.json` — 10-night headless soak test

## Architecture Boundaries
- `src/core/`: **pure TypeScript only**. Never import `three`, access `window`/`document`/`process`, or call `Math.random()` / `Date.now()`. Use seeded PRNG (`src/core/prng.ts`). Includes `types.ts`, `prng.ts`, `contract.ts` (`v1.3`), `maps.ts`, `game.ts` (+ `createBenchWorld`/`stepBenchWorld`), `benchMetrics.ts`, `leaderboard.ts`.
- `src/web/`: Three.js 3D world (`worldScene.ts`, `main.ts` incl. `?bench=1`), Web Audio (`audio.ts`), `localStorage` settings (`settings.ts` incl. `keybinds`, `colorblindMode`, `reduceMotion`, `largeText`), `leaderboardClient.ts`, and HUD (`ui.ts`, `>= 18px`).
- `src/cli/`: Node runners (`headless.ts`, `bench.ts`, `soak.ts`, `run.ts`).
- Relative imports in TS source must use `.js` extensions (`NodeNext` ESM + Vite compatible).

## Cross-Platform & Build Rules
- All scripts, paths, and tests must work identically on macOS, Linux, and Windows.
- Never add `.bat`/`.ps1` build scripts or commit `.env`/API keys.

## Performance & Regression Rules
- Preserve non-replaced Phase 1–2 contracts while enforcing Ticket-03 (`v1.2`); 21,600 headless ticks must complete in `<= 30s`; share Three.js geometries/materials cleanly.

## SDLC & Verification Rules
1. Never claim complete without running `npm run build` and `npm test` in the current turn and inspecting real output.
2. Record breaking changes in `CHANGELOG.md`, ADRs in `docs/notes/adr-*.md`, and assumptions in `docs/notes/assumptions.md`.
3. Record real observed command outputs in `docs/proof/phase-N/`; mark unfinished items honestly as "chưa đạt".
4. Log AI mistakes, harness updates, and estimated token usage in `docs/notes/ai-log.md`.
5. Keep all harness files (`AGENTS.md`, `.agents/`) in Git history.
