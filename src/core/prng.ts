/**
 * Creates a deterministic Mulberry32 pseudo-random number generator in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`Expected finite seed, received ${seed}`);
  }
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
