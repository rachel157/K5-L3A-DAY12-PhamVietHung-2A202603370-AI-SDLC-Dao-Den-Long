import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHeadlessSimulation } from "../core/game.js";
import type {
  DrifterState,
  GameContract,
  InputFrame,
  MoteKind,
  NightNumber,
  ScenarioCharmOverride,
  ScenarioConfig,
  ScenarioDrifterOverride,
  ScenarioLanternOverride,
  ScenarioMoteInput,
  ScenarioShadeOverride,
  ShadeBehaviorState,
  Vec3Tuple,
} from "../core/types.js";

class CliArgError extends Error {
  readonly exitCode = 1;
}

class ContractFileError extends Error {
  readonly exitCode = 2;
}

interface ParsedCliArgs {
  seed: number;
  night: NightNumber;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
  scenarioPath?: string;
  inputsPath?: string;
}

const VALID_SHADE_STATES = new Set<ShadeBehaviorState>([
  "spawning",
  "wander",
  "chase",
  "recoil",
  "stunned",
  "drain",
]);
const VALID_DRIFTER_STATES = new Set<DrifterState>(["idle", "chase", "flee", "removed"]);
const VALID_MOTE_KINDS = new Set<MoteKind>(["random", "dropped"]);

function validLanternIdsForNight(night: NightNumber): Set<string> {
  const count = night === 1 ? 5 : night === 2 ? 6 : 7;
  return new Set(Array.from({ length: count }, (_, i) => `L${i + 1}`));
}

function validCharmIdsForNight(night: NightNumber): Set<string> {
  if (night === 2) return new Set(["C1"]);
  if (night === 3) return new Set(["C1", "C2"]);
  return new Set();
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new CliArgError(`Missing value for ${flag}`);
  }
  return value;
}

function parseStrictInt(raw: string, flag: string): number {
  if (raw.trim() === "") {
    throw new CliArgError(`Invalid integer for ${flag}: "${raw}"`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new CliArgError(`Invalid integer for ${flag}: "${raw}"`);
  }
  return value;
}

function parseCliArgs(argv: string[]): ParsedCliArgs {
  let seed: number | undefined;
  let night: number | undefined;
  let ticks: number | undefined;
  let outPath: string | undefined;
  let snapshotEvery = 10;
  let scenarioPath: string | undefined;
  let inputsPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seed") {
      seed = parseStrictInt(requireValue(argv, i, "--seed"), "--seed");
      i++;
    } else if (arg === "--night") {
      night = parseStrictInt(requireValue(argv, i, "--night"), "--night");
      i++;
    } else if (arg === "--ticks") {
      ticks = parseStrictInt(requireValue(argv, i, "--ticks"), "--ticks");
      if (ticks < 0) {
        throw new CliArgError(`Expected non-negative integer for --ticks, received ${ticks}`);
      }
      i++;
    } else if (arg === "--out") {
      outPath = requireValue(argv, i, "--out");
      i++;
    } else if (arg === "--snapshot-every") {
      snapshotEvery = parseStrictInt(
        requireValue(argv, i, "--snapshot-every"),
        "--snapshot-every"
      );
      if (snapshotEvery <= 0) {
        throw new CliArgError(
          `Expected positive integer for --snapshot-every, received ${snapshotEvery}`
        );
      }
      i++;
    } else if (arg === "--scenario") {
      scenarioPath = requireValue(argv, i, "--scenario");
      i++;
    } else if (arg === "--inputs") {
      inputsPath = requireValue(argv, i, "--inputs");
      i++;
    } else {
      throw new CliArgError(`Unknown argument: ${arg}`);
    }
  }

  if (seed === undefined) throw new CliArgError("Missing required flag: --seed");
  if (night === undefined) throw new CliArgError("Missing required flag: --night");
  if (night !== 1 && night !== 2 && night !== 3) {
    throw new CliArgError(`Unsupported --night ${night} (Phase 2 supports nights 1, 2, 3)`);
  }
  if (ticks === undefined) throw new CliArgError("Missing required flag: --ticks");
  if (!outPath) throw new CliArgError("Missing required flag: --out");

  return {
    seed,
    night,
    ticks,
    outPath,
    snapshotEvery,
    scenarioPath,
    inputsPath,
  };
}

function readJsonFile(filePath: string, label: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ContractFileError(`Failed to read ${label} file "${filePath}": ${msg}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ContractFileError(`Invalid JSON in ${label} file "${filePath}": ${msg}`);
  }
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function assertVec3(val: unknown, ctx: string): Vec3Tuple {
  if (
    !Array.isArray(val) ||
    val.length !== 3 ||
    val.some((n) => typeof n !== "number" || !Number.isFinite(n))
  ) {
    throw new ContractFileError(`Expected [x, y, z] finite number tuple at ${ctx}`);
  }
  return [val[0] as number, val[1] as number, val[2] as number];
}

function assertNonNegInt(val: unknown, ctx: string): number {
  if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
    throw new ContractFileError(`${ctx} must be a non-negative integer`);
  }
  return val;
}

function assertNonNegFinite(val: unknown, ctx: string): number {
  if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
    throw new ContractFileError(`${ctx} must be a non-negative finite number`);
  }
  return val;
}

function parseInputsFile(filePath: string): InputFrame[] {
  const raw = readJsonFile(filePath, "inputs");
  if (!isPlainObject(raw) || !Array.isArray(raw.frames)) {
    throw new ContractFileError(`Inputs file "${filePath}" must contain a "frames" array`);
  }

  const frames: InputFrame[] = [];
  let prevTick = -1;
  for (let i = 0; i < raw.frames.length; i++) {
    const item = raw.frames[i];
    if (!isPlainObject(item)) {
      throw new ContractFileError(`frames[${i}] must be an object`);
    }
    const tick = assertNonNegInt(item.tick, `frames[${i}].tick`);
    if (tick <= prevTick) {
      throw new ContractFileError(
        `frames[${i}].tick (${tick}) must strictly increase after ${prevTick}`
      );
    }
    prevTick = tick;

    const frame: InputFrame = { tick };
    if (item.move !== undefined) {
      if (
        !Array.isArray(item.move) ||
        item.move.length !== 2 ||
        item.move.some((n) => typeof n !== "number" || !Number.isFinite(n))
      ) {
        throw new ContractFileError(`frames[${i}].move must be [x, z]`);
      }
      frame.move = [item.move[0] as number, item.move[1] as number];
    }
    if (item.cam_yaw_deg !== undefined) {
      if (typeof item.cam_yaw_deg !== "number" || !Number.isFinite(item.cam_yaw_deg)) {
        throw new ContractFileError(`frames[${i}].cam_yaw_deg must be a finite number`);
      }
      frame.cam_yaw_deg = item.cam_yaw_deg;
    }
    for (const key of ["jump", "dash", "interact", "pulse", "pause"] as const) {
      if (item[key] !== undefined) {
        if (typeof item[key] !== "boolean") {
          throw new ContractFileError(`frames[${i}].${key} must be boolean`);
        }
        frame[key] = item[key];
      }
    }
    frames.push(frame);
  }
  return frames;
}

function parseScenarioPlayer(rawPlayer: unknown): NonNullable<ScenarioConfig["player"]> {
  if (!isPlainObject(rawPlayer)) {
    throw new ContractFileError("scenario.player must be an object");
  }
  const player: NonNullable<ScenarioConfig["player"]> = {};
  if (rawPlayer.pos !== undefined) {
    player.pos = assertVec3(rawPlayer.pos, "scenario.player.pos");
  }
  for (const field of [
    "carried",
    "flames",
    "successful_lights",
    "invuln_ticks",
    "dash_cd_ticks",
    "pulse_cd_ticks",
    "charm_ticks",
  ] as const) {
    if (rawPlayer[field] !== undefined) {
      player[field] = assertNonNegInt(rawPlayer[field], `scenario.player.${field}`);
    }
  }
  return player;
}

function parseScenarioMotes(rawMotes: unknown): ScenarioMoteInput[] {
  if (!Array.isArray(rawMotes)) {
    throw new ContractFileError("scenario.motes must be an array");
  }
  return rawMotes.map((item, idx) => {
    if (Array.isArray(item)) {
      return assertVec3(item, `scenario.motes[${idx}]`);
    }
    if (!isPlainObject(item) || item.pos === undefined) {
      throw new ContractFileError(`scenario.motes[${idx}] must be [x,y,z] or {id?, pos, ...}`);
    }
    if (item.id !== undefined && typeof item.id !== "string") {
      throw new ContractFileError(`scenario.motes[${idx}].id must be a string`);
    }
    if (item.kind !== undefined && !VALID_MOTE_KINDS.has(item.kind as MoteKind)) {
      throw new ContractFileError(`scenario.motes[${idx}].kind must be "random" or "dropped"`);
    }
    return {
      id: item.id as string | undefined,
      pos: assertVec3(item.pos, `scenario.motes[${idx}].pos`),
      kind: item.kind as MoteKind | undefined,
      ttl_ticks:
        item.ttl_ticks !== undefined
          ? assertNonNegInt(item.ttl_ticks, `scenario.motes[${idx}].ttl_ticks`)
          : undefined,
      ttl_s:
        item.ttl_s !== undefined
          ? assertNonNegFinite(item.ttl_s, `scenario.motes[${idx}].ttl_s`)
          : undefined,
    };
  });
}

function parseScenarioShades(rawShades: unknown, night: NightNumber): ScenarioShadeOverride[] {
  if (!Array.isArray(rawShades)) {
    throw new ContractFileError("scenario.shades must be an array");
  }
  const validLanternIds = validLanternIdsForNight(night);
  return rawShades.map((item, idx) => {
    if (!isPlainObject(item) || item.pos === undefined) {
      throw new ContractFileError(
        `scenario.shades[${idx}] must be {pos, id?, state?, state_ticks_left?, target_lantern_id?}`
      );
    }
    if (item.id !== undefined && typeof item.id !== "string") {
      throw new ContractFileError(`scenario.shades[${idx}].id must be a string`);
    }
    if (item.state !== undefined && !VALID_SHADE_STATES.has(item.state as ShadeBehaviorState)) {
      throw new ContractFileError(
        `scenario.shades[${idx}].state must be spawning|wander|chase|recoil|stunned|drain`
      );
    }
    let targetLanternId: string | null | undefined;
    if (item.target_lantern_id !== undefined) {
      if (item.target_lantern_id === null) {
        targetLanternId = null;
      } else if (
        typeof item.target_lantern_id !== "string" ||
        !validLanternIds.has(item.target_lantern_id)
      ) {
        throw new ContractFileError(
          `scenario.shades[${idx}].target_lantern_id "${String(item.target_lantern_id)}" is not valid for Night ${night}`
        );
      } else {
        targetLanternId = item.target_lantern_id;
      }
    }
    return {
      id: item.id as string | undefined,
      pos: assertVec3(item.pos, `scenario.shades[${idx}].pos`),
      state: item.state as ShadeBehaviorState | undefined,
      state_ticks_left:
        item.state_ticks_left !== undefined
          ? assertNonNegInt(item.state_ticks_left, `scenario.shades[${idx}].state_ticks_left`)
          : undefined,
      target_lantern_id: targetLanternId,
    };
  });
}

function parseScenarioDrifters(rawDrifters: unknown): ScenarioDrifterOverride[] {
  if (!Array.isArray(rawDrifters)) {
    throw new ContractFileError("scenario.drifters must be an array");
  }
  return rawDrifters.map((item, idx) => {
    if (!isPlainObject(item) || item.pos === undefined) {
      throw new ContractFileError(`scenario.drifters[${idx}] must be {pos, id?, state?, stolen?, state_ticks_left?}`);
    }
    if (item.id !== undefined && typeof item.id !== "string") {
      throw new ContractFileError(`scenario.drifters[${idx}].id must be a string`);
    }
    if (item.state !== undefined && !VALID_DRIFTER_STATES.has(item.state as DrifterState)) {
      throw new ContractFileError(`scenario.drifters[${idx}].state must be idle|chase|flee|removed`);
    }
    return {
      id: item.id as string | undefined,
      pos: assertVec3(item.pos, `scenario.drifters[${idx}].pos`),
      state: item.state as DrifterState | undefined,
      stolen:
        item.stolen !== undefined
          ? assertNonNegInt(item.stolen, `scenario.drifters[${idx}].stolen`)
          : undefined,
      state_ticks_left:
        item.state_ticks_left !== undefined
          ? assertNonNegInt(item.state_ticks_left, `scenario.drifters[${idx}].state_ticks_left`)
          : undefined,
    };
  });
}

function parseScenarioCharms(rawCharms: unknown, night: NightNumber): ScenarioCharmOverride[] {
  if (!Array.isArray(rawCharms)) {
    throw new ContractFileError("scenario.charms must be an array");
  }
  const validIds = validCharmIdsForNight(night);
  return rawCharms.map((item, idx) => {
    if (!isPlainObject(item) || typeof item.id !== "string" || !validIds.has(item.id)) {
      throw new ContractFileError(
        `scenario.charms[${idx}].id "${String(item && (item as Record<string, unknown>).id)}" is not valid for Night ${night}`
      );
    }
    if (item.available !== undefined && typeof item.available !== "boolean") {
      throw new ContractFileError(`scenario.charms[${idx}].available must be boolean`);
    }
    return {
      id: item.id,
      pos: item.pos !== undefined ? assertVec3(item.pos, `scenario.charms[${idx}].pos`) : undefined,
      available: item.available as boolean | undefined,
      respawn_ticks:
        item.respawn_ticks !== undefined
          ? assertNonNegInt(item.respawn_ticks, `scenario.charms[${idx}].respawn_ticks`)
          : undefined,
      respawn_s:
        item.respawn_s !== undefined
          ? assertNonNegFinite(item.respawn_s, `scenario.charms[${idx}].respawn_s`)
          : undefined,
    };
  });
}

function parseScenarioLanterns(rawLanterns: unknown, night: NightNumber): ScenarioLanternOverride[] {
  if (!Array.isArray(rawLanterns)) {
    throw new ContractFileError("scenario.lanterns must be an array");
  }
  const validIds = validLanternIdsForNight(night);
  return rawLanterns.map((item, idx) => {
    if (!isPlainObject(item) || typeof item.id !== "string" || !validIds.has(item.id)) {
      throw new ContractFileError(
        `scenario.lanterns[${idx}].id must be valid for Night ${night}`
      );
    }
    if (item.lit !== undefined && typeof item.lit !== "boolean") {
      throw new ContractFileError(`scenario.lanterns[${idx}].lit must be boolean`);
    }
    if (item.ever_lit !== undefined && typeof item.ever_lit !== "boolean") {
      throw new ContractFileError(`scenario.lanterns[${idx}].ever_lit must be boolean`);
    }
    let fuel: number | undefined;
    if (item.fuel !== undefined) {
      fuel = assertNonNegFinite(item.fuel, `scenario.lanterns[${idx}].fuel`);
      if (fuel > 100) {
        throw new ContractFileError(`scenario.lanterns[${idx}].fuel must be <= 100`);
      }
    }
    return {
      id: item.id,
      pos: item.pos !== undefined ? assertVec3(item.pos, `scenario.lanterns[${idx}].pos`) : undefined,
      lit: item.lit as boolean | undefined,
      deposited:
        item.deposited !== undefined
          ? assertNonNegInt(item.deposited, `scenario.lanterns[${idx}].deposited`)
          : undefined,
      fuel,
      ever_lit: item.ever_lit as boolean | undefined,
    };
  });
}

function parseScenarioFile(filePath: string, night: NightNumber): ScenarioConfig {
  const raw = readJsonFile(filePath, "scenario");
  if (!isPlainObject(raw)) {
    throw new ContractFileError(`Scenario file "${filePath}" must be a JSON object`);
  }
  const scenario: ScenarioConfig = {};

  if (raw.player !== undefined) scenario.player = parseScenarioPlayer(raw.player);

  for (const flag of ["random_motes", "random_shades", "random_drifters", "wind_enabled"] as const) {
    if (raw[flag] !== undefined) {
      if (typeof raw[flag] !== "boolean") {
        throw new ContractFileError(`scenario.${flag} must be boolean`);
      }
      scenario[flag] = raw[flag];
    }
  }

  if (raw.time_left_s !== undefined) {
    scenario.time_left_s = assertNonNegFinite(raw.time_left_s, "scenario.time_left_s");
  }

  if (raw.motes !== undefined) scenario.motes = parseScenarioMotes(raw.motes);
  if (raw.shades !== undefined) scenario.shades = parseScenarioShades(raw.shades, night);
  if (raw.drifters !== undefined) scenario.drifters = parseScenarioDrifters(raw.drifters);
  if (raw.charms !== undefined) scenario.charms = parseScenarioCharms(raw.charms, night);
  if (raw.lanterns !== undefined) scenario.lanterns = parseScenarioLanterns(raw.lanterns, night);

  return scenario;
}

function loadContractTuning(): GameContract {
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const contractPath = path.resolve(cliDir, "../../game.contract.json");
  const raw = fs.readFileSync(contractPath, "utf8");
  return JSON.parse(raw) as GameContract;
}

function main(): void {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const contract = loadContractTuning();
    const scenario = args.scenarioPath
      ? parseScenarioFile(args.scenarioPath, args.night)
      : undefined;
    const frames = args.inputsPath ? parseInputsFile(args.inputsPath) : undefined;

    const lines = runHeadlessSimulation({
      seed: args.seed,
      night: args.night,
      tuning: contract.tuning,
      scenario,
      frames,
      maxTicks: args.ticks,
      snapshotEvery: args.snapshotEvery,
    });

    fs.mkdirSync(path.dirname(path.resolve(args.outPath)), { recursive: true });
    const serialized = lines.map((record) => JSON.stringify(record)).join("\n") + "\n";
    fs.writeFileSync(args.outPath, serialized, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Headless error: ${message}`);
    if (err instanceof ContractFileError) {
      process.exitCode = err.exitCode;
    } else {
      process.exitCode = 1;
    }
  }
}

main();
