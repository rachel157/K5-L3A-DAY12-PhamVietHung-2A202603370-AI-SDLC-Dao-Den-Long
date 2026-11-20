import { round1 } from "./contract.js";

export interface BenchReport {
  contract_version: "1.3";
  avg_fps: number;
  p1_low_fps: number;
  frame_ms_p95: number;
  frames: number;
  load_ms: number;
  peak_mem_mb: number | null;
  vsync_off: boolean;
  renderer: string;
  os: string;
}

export function computeBenchMetrics(params: {
  dtListMs: ReadonlyArray<number>;
  loadMs: number;
  peakMemMb: number | null;
  vsyncOff: boolean;
  renderer: string;
  osName: string;
}): BenchReport {
  const n = params.dtListMs.length;
  if (n === 0) {
    return {
      contract_version: "1.3",
      avg_fps: 0,
      p1_low_fps: 0,
      frame_ms_p95: 0,
      frames: 0,
      load_ms: Math.round(params.loadMs),
      peak_mem_mb: params.peakMemMb,
      vsync_off: params.vsyncOff,
      renderer: params.renderer,
      os: params.osName,
    };
  }

  let sumDt = 0;
  for (let i = 0; i < n; i++) {
    sumDt += params.dtListMs[i]!;
  }
  const avgFps = sumDt > 0 ? (1000 * n) / sumDt : 0;

  const sortedAsc = [...params.dtListMs].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  let sumWorst = 0;
  for (let i = n - k; i < n; i++) {
    sumWorst += sortedAsc[i]!;
  }
  const avgWorstDt = sumWorst / k;
  const p1LowFps = avgWorstDt > 0 ? 1000 / avgWorstDt : 0;

  const p95Idx = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
  const frameMsP95 = sortedAsc[p95Idx]!;

  return {
    contract_version: "1.3",
    avg_fps: round1(avgFps),
    p1_low_fps: round1(p1LowFps),
    frame_ms_p95: round1(frameMsP95),
    frames: n,
    load_ms: Math.round(params.loadMs),
    peak_mem_mb: params.peakMemMb,
    vsync_off: params.vsyncOff,
    renderer: params.renderer,
    os: params.osName,
  };
}
