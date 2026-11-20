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
      player: { pos: [0, 0, 0], carried: 9, flames: 3 },
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
      runCli(["--seed", "1", "--night", "4", "--ticks", "10", "--out", outPath]).status,
      1
    );
    assert.equal(
      runCli(["--seed", "1", "--night", "0", "--ticks", "10", "--out", outPath]).status,
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

test("headless CLI supports Nights 2 and 3 deterministically and parses Contract v1.1 scenario & inputs", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-v11-"));
  const n2Out1 = path.join(tmpDir, "n2a.jsonl");
  const n2Out2 = path.join(tmpDir, "n2b.jsonl");
  const n3ScenPath = path.join(tmpDir, "n3-scen.json");
  const n3InputsPath = path.join(tmpDir, "n3-inputs.json");
  const n3Out = path.join(tmpDir, "n3.jsonl");
  const badDrifterPath = path.join(tmpDir, "bad-drifter.json");
  const badDashInputPath = path.join(tmpDir, "bad-dash.json");
  const errOut = path.join(tmpDir, "err.jsonl");

  fs.writeFileSync(
    n3ScenPath,
    JSON.stringify({
      player: {
        pos: [0, 0, -20],
        carried: 3,
        flames: 3,
        invuln_ticks: 10,
        dash_cd_ticks: 0,
        pulse_cd_ticks: 0,
        charm_ticks: 0,
      },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: true,
      motes: [{ id: "M1", pos: [0, 0, 5], kind: "dropped", ttl_ticks: 120 }],
      shades: [{ id: "S1", pos: [0, 0.8, 35], state: "wander", state_ticks_left: 0 }],
      drifters: [{ id: "D1", pos: [20, 1.6, 0], state: "idle" }],
      charms: [{ id: "C1", available: false, respawn_ticks: 50 }],
      lanterns: [{ id: "L7", lit: false, deposited: 5 }],
    })
  );

  fs.writeFileSync(
    n3InputsPath,
    JSON.stringify({
      frames: [
        { tick: 0, move: [0, 1], dash: true },
        { tick: 1, dash: false },
        { tick: 5, pause: true },
        { tick: 6, pause: false },
        { tick: 10, pause: true },
        { tick: 11, pause: false },
      ],
    })
  );

  fs.writeFileSync(
    badDrifterPath,
    JSON.stringify({ drifters: [{ id: "D1", pos: [0, 1, 0], state: "flying" }] })
  );
  fs.writeFileSync(
    badDashInputPath,
    JSON.stringify({ frames: [{ tick: 0, dash: "yes" }] })
  );

  try {
    const r2a = runCli(["--seed", "7", "--night", "2", "--ticks", "30", "--out", n2Out1]);
    const r2b = runCli(["--seed", "7", "--night", "2", "--ticks", "30", "--out", n2Out2]);
    assert.equal(r2a.status, 0, r2a.stderr);
    assert.equal(r2b.status, 0, r2b.stderr);
    assert.equal(fs.readFileSync(n2Out1, "utf8"), fs.readFileSync(n2Out2, "utf8"));
    const n2Records = readJsonl(n2Out1);
    assert.equal(n2Records[0].night, 2);
    assert.equal(n2Records[0].lanterns.length, 6);
    assert.equal(n2Records[0].charms[0].id, "C1");

    const r3 = runCli([
      "--seed",
      "9",
      "--night",
      "3",
      "--scenario",
      n3ScenPath,
      "--inputs",
      n3InputsPath,
      "--ticks",
      "20",
      "--snapshot-every",
      "5",
      "--out",
      n3Out,
    ]);
    assert.equal(r3.status, 0, r3.stderr);
    const n3Records = readJsonl(n3Out);
    assert.equal(n3Records[0].night, 3);
    assert.equal(n3Records[0].lanterns.length, 7);
    const eventNames = n3Records.filter((r) => r.type === "event").map((r) => r.name);
    assert.ok(eventNames.includes("night_start"));
    assert.ok(eventNames.includes("dash"));
    assert.ok(eventNames.includes("paused"));
    assert.ok(eventNames.includes("resumed"));
    const snap10 = n3Records.find((r) => r.type === "snapshot" && r.tick === 10);
    assert.equal(snap10.state, "paused");

    // Validation errors for v1.1 schema must exit 2
    assert.equal(
      runCli(["--seed", "1", "--night", "2", "--scenario", badDrifterPath, "--ticks", "5", "--out", errOut])
        .status,
      2
    );
    assert.equal(
      runCli(["--seed", "1", "--night", "2", "--inputs", badDashInputPath, "--ticks", "5", "--out", errOut])
        .status,
      2
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
