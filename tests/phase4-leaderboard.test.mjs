import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addLeaderboardEntry,
  formatIsoWithTimezone,
  sortLeaderboardEntries,
  validateLeaderboardName,
} from "../dist-cli/core/leaderboard.js";

test("validateLeaderboardName enforces 3-12 [A-Za-z0-9_] or Vietnamese letters without spaces/symbols", () => {
  assert.equal(validateLeaderboardName("May_01").valid, true);
  assert.equal(validateLeaderboardName("Mây_Đêm").valid, true);
  assert.equal(validateLeaderboardName("ab").valid, false);
  assert.equal(validateLeaderboardName("abcdefghijklm").valid, false);
  assert.equal(validateLeaderboardName("May 01").valid, false);
  assert.equal(validateLeaderboardName("May@01").valid, false);
});

test("leaderboard sorts by score desc, tie-breaks earlier achieved_at first, caps top 10, and formats ISO timezone", () => {
  const iso = formatIsoWithTimezone(new Date("2026-11-20T10:30:00.000Z"));
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/);

  let entries = [];
  for (let i = 1; i <= 11; i++) {
    entries = addLeaderboardEntry(entries, {
      name: `Player_${i}`,
      score: i * 100,
      nights_won: i % 4,
      achieved_at: `2026-11-20T10:${String(i).padStart(2, "0")}:00+07:00`,
      seed: i,
    });
  }
  assert.equal(entries.length, 10);
  assert.equal(entries[0].score, 1100);
  assert.equal(entries[9].score, 200);

  // Tie-break: earlier achieved_at must rank higher
  const tied = sortLeaderboardEntries([
    { name: "Later", score: 500, nights_won: 1, achieved_at: "2026-11-20T12:00:00+07:00", seed: 2 },
    { name: "Earlier", score: 500, nights_won: 1, achieved_at: "2026-11-20T11:00:00+07:00", seed: 1 },
  ]);
  assert.equal(tied[0].name, "Earlier");
  assert.equal(tied[1].name, "Later");
});

test("run CLI --export-leaderboard writes sorted {\"entries\": [...]} JSON and handles empty file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lb-export-"));
  const dbPath = path.join(tmpDir, "leaderboard.json");
  const outPath = path.join(tmpDir, "out.json");
  const emptyOutPath = path.join(tmpDir, "empty.json");

  try {
    const emptyRes = spawnSync(
      process.execPath,
      ["dist-cli/cli/run.js", "--export-leaderboard", emptyOutPath],
      { env: { ...process.env, DDL_LEADERBOARD_PATH: dbPath }, encoding: "utf8" }
    );
    assert.equal(emptyRes.status, 0, emptyRes.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(emptyOutPath, "utf8")), { entries: [] });

    fs.writeFileSync(
      dbPath,
      JSON.stringify({
        entries: [
          { name: "B_Second", score: 400, nights_won: 1, achieved_at: "2026-11-20T12:00:00+07:00", seed: 2 },
          { name: "A_First", score: 900, nights_won: 3, achieved_at: "2026-11-20T11:00:00+07:00", seed: 1 },
        ],
      })
    );
    const res = spawnSync(
      process.execPath,
      ["dist-cli/cli/run.js", "--export-leaderboard", outPath],
      { env: { ...process.env, DDL_LEADERBOARD_PATH: dbPath }, encoding: "utf8" }
    );
    assert.equal(res.status, 0, res.stderr);
    const exported = JSON.parse(fs.readFileSync(outPath, "utf8"));
    assert.equal(exported.entries.length, 2);
    assert.equal(exported.entries[0].name, "A_First");
    assert.equal(exported.entries[1].name, "B_Second");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
