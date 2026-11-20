# Đảo Đèn Lồng — Agent Guidelines

Game 3D + chế độ headless deterministic (TypeScript + Vite + Three.js + Node ^20.19.0 || >=22.12.0; compiled `dist-cli/` runs on Node 18+).

## Commands
- `npm install` — install dependencies
- `npm run build` — compile CLI (`dist-cli/`) and web (`dist/`)
- `npm test` — compile CLI/core and run `node --test`
- `npm run headless` — run headless CLI (`node dist-cli/cli/headless.js`)
- `npm run dev` / `npm run preview` — run 3D web app locally

## Architecture Boundaries
- `src/core/`: **pure TypeScript only**. Never import `three`, access `window`/`document`/`process`, or call `Math.random()` / `Date.now()`. Use seeded PRNG (`src/core/prng.ts`).
- `src/web/`: Three.js 3D rendering reading snapshots from `src/core/`.
- `src/cli/`: Node headless runner reading args/stdin and calling `src/core/`.
- Relative imports in TS source must use `.js` extensions (`NodeNext` ESM + Vite compatible).

## Cross-Platform & Build Rules
- All scripts, paths, and tests must work identically on macOS, Linux, and Windows.
- Never add `.bat`/`.ps1` build scripts or commit `.env`/API keys.

## SDLC & Verification Rules
1. Never claim a task is complete without running `npm run build` and `npm test` in the current turn and inspecting real output.
2. Before coding each phase, document ambiguities and assumptions in `docs/notes/assumptions.md`.
3. Update `docs/proof/phase-N/` with real observed command outputs matching the phase tag; record unfinished items honestly as "chưa đạt".
4. Log AI mistakes, harness updates, and estimated token usage in `docs/notes/ai-log.md`.
5. Keep all harness files (`AGENTS.md`, `.agents/`) in Git history.
