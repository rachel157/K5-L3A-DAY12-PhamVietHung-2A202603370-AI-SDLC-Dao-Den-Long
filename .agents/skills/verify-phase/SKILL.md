---
name: verify-phase
description: >-
  Use this skill when verifying a lab phase or checkpoint before tagging or
  recording proof in docs/proof/. Runs build, unit/headless tests, determinism
  checks, and captures observed evidence.
---

# Verify Phase & Capture Evidence

Run this procedure at the end of every phase before committing proof or creating a `phase-N` tag.

## Steps

1. **Full build (CLI + Web):**
   ```bash
   npm run build
   ```
   Verify exit code `0` and outputs in `dist-cli/` and `dist/`.

2. **Unit, boundary, and CLI test suite:**
   ```bash
   npm test
   ```
   Verify 0 failures across all `tests/*.test.mjs` files.

3. **Determinism check (two identical headless runs per night across bash/PowerShell):**
   ```bash
   node dist-cli/cli/headless.js --seed 7 --night 1 --ticks 60 --out verify-n1-r1.jsonl
   node dist-cli/cli/headless.js --seed 7 --night 1 --ticks 60 --out verify-n1-r2.jsonl
   node dist-cli/cli/headless.js --seed 7 --night 2 --ticks 60 --out verify-n2-r1.jsonl
   node dist-cli/cli/headless.js --seed 7 --night 2 --ticks 60 --out verify-n2-r2.jsonl
   node dist-cli/cli/headless.js --seed 7 --night 3 --ticks 60 --out verify-n3-r1.jsonl
   node dist-cli/cli/headless.js --seed 7 --night 3 --ticks 60 --out verify-n3-r2.jsonl
   ```
   Confirm each night's `r1` and `r2` are byte-for-byte identical (plus benchmark 21,600 ticks on Night 3 completes in <= 30s), then delete the temporary `.jsonl` files.

4. **Clean git state & secret check:**
   Run `git status` and confirm no `.env`, API keys, or temporary artifacts are staged.

5. **Record honest proof:**
   Save observed outputs (never hand-edited) in `docs/proof/phase-N/README.md`, mapping each requirement to its test/command result. Mark incomplete items honestly as `chưa đạt`.
