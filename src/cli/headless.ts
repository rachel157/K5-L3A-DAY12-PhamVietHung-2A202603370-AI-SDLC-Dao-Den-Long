import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHeadlessSimulation } from "../core/game.js";
import type {
  GameContract,
  InputFrame,
  ScenarioConfig,
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
  night: number;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
  scenarioPath?: string;
  inputsPath?: string;
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
  if (night !== 1) throw new CliArgError(`Unsupported --night ${night} (Phase 1 supports night 1)`);
  if (ticks === undefined) throw new CliArgError("Missing required flag: --ticks");
  if (!outPath) throw new CliArgError("Missing required flag: --out");

  return { seed, night, ticks, outPath, snapshotEvery, scenarioPath, inputsPath };
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
    const tick = item.tick;
    if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0) {
      throw new ContractFileError(`frames[${i}].tick must be a non-negative integer`);
    }
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
    for (const key of ["jump", "interact", "pulse"] as const) {
      if (item[key] !== undefined) {
        if (typeof item[key] !== "boolean") {
          throw new ContractFileError(`frames[${i}].${key} must be boolean`);
        }
        frame[key] = item[key] as boolean;
      }
    }
    frames.push(frame);
  }
  return frames;
}

function parseScenarioFile(filePath: string): ScenarioConfig {
  const raw = readJsonFile(filePath, "scenario");
  if (!isPlainObject(raw)) {
    throw new ContractFileError(`Scenario file "${filePath}" must be a JSON object`);
  }
  const scenario: ScenarioConfig = {};

  if (raw.player !== undefined) {
    if (!isPlainObject(raw.player)) {
      throw new ContractFileError("scenario.player must be an object");
    }
    scenario.player = {};
    if (raw.player.pos !== undefined) {
      scenario.player.pos = assertVec3(raw.player.pos, "scenario.player.pos");
    }
    if (raw.player.carried !== undefined) {
      if (
        typeof raw.player.carried !== "number" ||
        !Number.isInteger(raw.player.carried) ||
        raw.player.carried < 0
      ) {
        throw new ContractFileError("scenario.player.carried must be a non-negative integer");
      }
      scenario.player.carried = raw.player.carried;
    }
    if (raw.player.flames !== undefined) {
      if (
        typeof raw.player.flames !== "number" ||
        !Number.isInteger(raw.player.flames) ||
        raw.player.flames < 0
      ) {
        throw new ContractFileError("scenario.player.flames must be a non-negative integer");
      }
      scenario.player.flames = raw.player.flames;
    }
  }

  for (const flag of ["random_motes", "random_shades"] as const) {
    if (raw[flag] !== undefined) {
      if (typeof raw[flag] !== "boolean") {
        throw new ContractFileError(`scenario.${flag} must be boolean`);
      }
      scenario[flag] = raw[flag] as boolean;
    }
  }

  if (raw.time_left_s !== undefined) {
    if (typeof raw.time_left_s !== "number" || !Number.isFinite(raw.time_left_s)) {
      throw new ContractFileError("scenario.time_left_s must be a finite number");
    }
    scenario.time_left_s = raw.time_left_s;
  }

  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) {
      throw new ContractFileError("scenario.motes must be an array");
    }
    scenario.motes = raw.motes.map((item, idx) => {
      if (Array.isArray(item)) {
        return assertVec3(item, `scenario.motes[${idx}]`);
      }
      if (isPlainObject(item) && item.pos !== undefined) {
        if (item.id !== undefined && typeof item.id !== "string") {
          throw new ContractFileError(`scenario.motes[${idx}].id must be a string`);
        }
        return {
          id: item.id as string | undefined,
          pos: assertVec3(item.pos, `scenario.motes[${idx}].pos`),
        };
      }
      throw new ContractFileError(`scenario.motes[${idx}] must be [x,y,z] or {id?, pos}`);
    });
  }

  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) {
      throw new ContractFileError("scenario.shades must be an array");
    }
    scenario.shades = raw.shades.map((item, idx) => {
      if (!isPlainObject(item) || item.pos === undefined) {
        throw new ContractFileError(`scenario.shades[${idx}] must be {pos, id?, state?}`);
      }
      if (item.id !== undefined && typeof item.id !== "string") {
        throw new ContractFileError(`scenario.shades[${idx}].id must be a string`);
      }
      if (item.state !== undefined && item.state !== "chase" && item.state !== "stunned") {
        throw new ContractFileError(`scenario.shades[${idx}].state must be "chase" or "stunned"`);
      }
      return {
        id: item.id as string | undefined,
        pos: assertVec3(item.pos, `scenario.shades[${idx}].pos`),
        state: item.state as "chase" | "stunned" | undefined,
      };
    });
  }

  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) {
      throw new ContractFileError("scenario.lanterns must be an array");
    }
    const validIds = new Set(["L1", "L2", "L3", "L4", "L5"]);
    scenario.lanterns = raw.lanterns.map((item, idx) => {
      if (!isPlainObject(item) || typeof item.id !== "string" || !validIds.has(item.id)) {
        throw new ContractFileError(`scenario.lanterns[${idx}].id must be one of L1..L5`);
      }
      if (item.lit !== undefined && typeof item.lit !== "boolean") {
        throw new ContractFileError(`scenario.lanterns[${idx}].lit must be boolean`);
      }
      if (
        item.deposited !== undefined &&
        (typeof item.deposited !== "number" || !Number.isInteger(item.deposited) || item.deposited < 0)
      ) {
        throw new ContractFileError(`scenario.lanterns[${idx}].deposited must be non-negative int`);
      }
      return {
        id: item.id,
        pos: item.pos !== undefined ? assertVec3(item.pos, `scenario.lanterns[${idx}].pos`) : undefined,
        lit: item.lit as boolean | undefined,
        deposited: item.deposited as number | undefined,
      };
    });
  }

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
    const scenario = args.scenarioPath ? parseScenarioFile(args.scenarioPath) : undefined;
    const frames = args.inputsPath ? parseInputsFile(args.inputsPath) : undefined;

    const lines = runHeadlessSimulation({
      seed: args.seed,
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
