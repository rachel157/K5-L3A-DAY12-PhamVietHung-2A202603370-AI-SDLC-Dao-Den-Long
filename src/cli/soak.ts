import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { round1 } from "../core/contract.js";
import { createGameWorld, stepGameWorld } from "../core/game.js";
import { createSeededRng } from "../core/prng.js";
import type { MoveTuple, NightNumber } from "../core/types.js";

interface SoakArgs {
  seed: number;
  nights: number;
  outPath: string;
}

function parseSoakArgs(argv: string[]): SoakArgs {
  let seed: number | null = null;
  let nights = 10;
  let outPath: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--seed" && i + 1 < argv.length) {
      seed = Number(argv[++i]);
    } else if (arg === "--nights" && i + 1 < argv.length) {
      nights = Number(argv[++i]);
    } else if (arg === "--out" && i + 1 < argv.length) {
      outPath = argv[++i]!;
    } else {
      throw new Error(`Unknown or incomplete flag: ${arg}`);
    }
  }

  if (seed === null || !Number.isInteger(seed)) {
    throw new Error("--seed must be an integer");
  }
  if (!Number.isInteger(nights) || nights <= 0) {
    throw new Error("--nights must be a positive integer");
  }
  if (!outPath) {
    throw new Error("--out <path> is required");
  }
  return { seed, nights, outPath };
}

function rssMb(): number {
  return round1(process.memoryUsage().rss / (1024 * 1024));
}

function main(): void {
  const args = parseSoakArgs(process.argv.slice(2));
  const t0 = performance.now();
  const results: Array<"won" | "lost"> = [];
  let crashes = 0;
  let memStartMb = 0;

  for (let i = 0; i < args.nights; i++) {
    const night = (((i % 3) + 1) as NightNumber);
    const nightSeed = args.seed + i;
    try {
      const world = createGameWorld({ seed: nightSeed, night });
      if (i === 0) {
        memStartMb = rssMb();
      }
      const inputRng = createSeededRng((nightSeed ^ 0x9e3779b9) >>> 0);
      let move: MoveTuple = [0, 1];
      const safetyMaxTicks = world.timeLeftTicks + 120;

      for (let t = 0; t < safetyMaxTicks && world.state === "playing"; t++) {
        if (t % 30 === 0) {
          const angle = inputRng() * Math.PI * 2;
          move = [Math.cos(angle), Math.sin(angle)];
        }
        const jump = inputRng() < 0.05;
        const dash = inputRng() < 0.03;
        const pulse = inputRng() < 0.02;
        const interact = inputRng() < 0.1;

        stepGameWorld(world, {
          move,
          cam_yaw_deg: 0,
          jump,
          dash,
          pulse,
          interact,
          pause: false,
        });
      }

      results.push(world.state === "won" ? "won" : "lost");
    } catch (err) {
      crashes += 1;
      results.push("lost");
      console.error(`Soak night ${i} crashed:`, err);
    }
  }

  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc === "function") gc();
  const memEndMb = rssMb();
  const durationS = round1((performance.now() - t0) / 1000);

  const report = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  fs.mkdirSync(path.dirname(path.resolve(args.outPath)), { recursive: true });
  fs.writeFileSync(args.outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  if (crashes > 0) {
    process.exitCode = 1;
  }
}

main();
