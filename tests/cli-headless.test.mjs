import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const runCli = (args) =>
  spawnSync(process.execPath, ["dist-cli/cli/headless.js", ...args], { encoding: "utf8" });

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  return raw.split(/\r?\n/).map((line) => JSON.parse(line));
}

test("headless CLI runs Night 1 default world and writes valid JSONL", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-default-"));
  const outPath = path.join(tmpDir, "nested", "run.jsonl");
  try {
    const res = runCli([
      "--seed",
      "7",
      "--night",
      "1",
      "--ticks",
      "20",
      "--out",
      outPath,
      "--snapshot-every",
      "10",
    ]);
    assert.equal(res.status, 0, res.stderr);
    const records = readJsonl(outPath);
    assert.equal(records[0].type, "snapshot");
    assert.equal(records[0].tick, 0);
    assert.equal(records[records.length - 1].type, "end");
    assert.equal(records[records.length - 1].ticks, 20);
    const snapshots = records.filter((r) => r.type === "snapshot");
    assert.deepEqual(
      snapshots.map((s) => s.tick),
      [0, 10, 20]
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("headless CLI runs scenario + inputs to deterministic won JSONL", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-win-"));
  const scenarioPath = path.join(tmpDir, "scenario.json");
  const inputsPath = path.join(tmpDir, "inputs.json");
  const out1 = path.join(tmpDir, "out1.jsonl");
  const out2 = path.join(tmpDir, "out2.jsonl");

  fs.writeFileSync(
    scenarioPath,
    JSON.stringify({
      player: { pos: [0, 0, 0], carried: 2, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 6]],
      shades: [{ id: "S1", pos: [20, 0, 0] }],
      lanterns: [
        { id: "L1", lit: true },
        { id: "L2", lit: true },
        { id: "L3", lit: true },
        { id: "L4", lit: true },
        { id: "L5", pos: [0, 0, 12], deposited: 0 },
      ],
      time_left_s: 300,
    })
  );

  // Move +Z at 6m/s -> reaches mote at z=6 (t~60) and L5 at z=12 (t~120), then interacts
  fs.writeFileSync(
    inputsPath,
    JSON.stringify({
      frames: [
        { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
        { tick: 115, move: [0, 0], interact: true },
        { tick: 116, interact: false },
      ],
    })
  );

  try {
    const r1 = runCli([
      "--seed",
      "42",
      "--night",
      "1",
      "--scenario",
      scenarioPath,
      "--inputs",
      inputsPath,
      "--ticks",
      "300",
      "--out",
      out1,
    ]);
    const r2 = runCli([
      "--seed",
      "42",
      "--night",
      "1",
      "--scenario",
      scenarioPath,
      "--inputs",
      inputsPath,
      "--ticks",
      "300",
      "--out",
      out2,
    ]);
    assert.equal(r1.status, 0, r1.stderr);
    assert.equal(r2.status, 0, r2.stderr);

    const raw1 = fs.readFileSync(out1, "utf8");
    const raw2 = fs.readFileSync(out2, "utf8");
    assert.equal(raw1, raw2);

    const records = readJsonl(out1);
    const eventNames = records.filter((r) => r.type === "event").map((r) => r.name);
    assert.ok(eventNames.includes("mote_picked"));
    assert.ok(eventNames.includes("deposit"));
    assert.ok(eventNames.includes("lantern_lit"));
    assert.ok(eventNames.includes("game_over"));
    const end = records[records.length - 1];
    assert.equal(end.type, "end");
    assert.equal(end.state, "won");
    assert.ok(end.ticks < 300);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("headless CLI exits 2 on missing or malformed scenario/inputs files", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-err2-"));
  const badJsonPath = path.join(tmpDir, "bad.json");
  const dupTickPath = path.join(tmpDir, "dup.json");
  const unknownLanternPath = path.join(tmpDir, "lantern.json");
  const outPath = path.join(tmpDir, "out.jsonl");

  fs.writeFileSync(badJsonPath, "{not valid json");
  fs.writeFileSync(
    dupTickPath,
    JSON.stringify({ frames: [{ tick: 5, move: [0, 1] }, { tick: 5, move: [0, 0] }] })
  );
  fs.writeFileSync(unknownLanternPath, JSON.stringify({ lanterns: [{ id: "L99", lit: true }] }));

  try {
    const rMissing = runCli([
      "--seed",
      "1",
      "--night",
      "1",
      "--scenario",
      path.join(tmpDir, "nope.json"),
      "--ticks",
      "10",
      "--out",
      outPath,
    ]);
    assert.equal(rMissing.status, 2);
    assert.ok(rMissing.stderr.length > 0);

    const rBadJson = runCli([
      "--seed",
      "1",
      "--night",
      "1",
      "--inputs",
      badJsonPath,
      "--ticks",
      "10",
      "--out",
      outPath,
    ]);
    assert.equal(rBadJson.status, 2);

    const rDupTick = runCli([
      "--seed",
      "1",
      "--night",
      "1",
      "--inputs",
      dupTickPath,
      "--ticks",
      "10",
      "--out",
      outPath,
    ]);
    assert.equal(rDupTick.status, 2);

    const rUnknownLantern = runCli([
      "--seed",
      "1",
      "--night",
      "1",
      "--scenario",
      unknownLanternPath,
      "--ticks",
      "10",
      "--out",
      outPath,
    ]);
    assert.equal(rUnknownLantern.status, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("headless CLI exits 1 on missing or invalid CLI arguments", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-err1-"));
  const outPath = path.join(tmpDir, "out.jsonl");
  try {
    assert.equal(runCli(["--seed", "1", "--ticks", "10", "--out", outPath]).status, 1);
    assert.equal(
      runCli(["--seed", "1", "--night", "2", "--ticks", "10", "--out", outPath]).status,
      1
    );
    assert.equal(runCli(["--seed", "1", "--night", "1", "--ticks", "10"]).status, 1);
    assert.equal(
      runCli([
        "--seed",
        "1",
        "--night",
        "1",
        "--ticks",
        "10",
        "--out",
        outPath,
        "--snapshot-every",
        "0",
      ]).status,
      1
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
