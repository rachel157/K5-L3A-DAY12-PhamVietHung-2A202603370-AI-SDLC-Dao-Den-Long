import { runLanternSimulation } from "../core/helloLantern.js";

interface HeadlessArgs {
  seed: number;
  ticks: number;
  dtSec: number;
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseStrictInt(raw: string, flag: string): number {
  if (raw.trim() === "") {
    throw new Error(`Invalid integer for ${flag}: "${raw}"`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer for ${flag}: "${raw}"`);
  }
  return value;
}

function parsePositiveFloat(raw: string, flag: string): number {
  if (raw.trim() === "") {
    throw new Error(`Invalid number for ${flag}: "${raw}"`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Expected positive number for ${flag}, received "${raw}"`);
  }
  return value;
}

function parseCliArgs(argv: string[]): HeadlessArgs {
  let seed = 1;
  let ticks = 10;
  let dtSec = 0.05;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seed") {
      seed = parseStrictInt(requireValue(argv, i, "--seed"), "--seed");
      i++;
    } else if (arg === "--ticks") {
      ticks = parseStrictInt(requireValue(argv, i, "--ticks"), "--ticks");
      if (ticks < 0) {
        throw new Error(`Expected non-negative integer for --ticks, received ${ticks}`);
      }
      i++;
    } else if (arg === "--dt") {
      dtSec = parsePositiveFloat(requireValue(argv, i, "--dt"), "--dt");
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { seed, ticks, dtSec };
}

function main(): void {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const finalState = runLanternSimulation(args.seed, args.ticks, args.dtSec);
    console.log(
      JSON.stringify({
        ok: true,
        mode: "hello-cp0",
        seed: args.seed,
        ticks: args.ticks,
        dtSec: args.dtSec,
        finalState,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Headless error: ${message}`);
    process.exitCode = 1;
  }
}

main();
