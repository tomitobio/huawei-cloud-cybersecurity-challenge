/**
 * Deterministic pseudo-random utilities for reproducible scenario variability.
 *
 * Same seed -> same sequence, always. This is what lets a workshop be replayed
 * exactly: the session stores one seed and every derived number can be
 * recomputed from it. No external dependencies, pure functions only.
 */

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 * Returns a function producing floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mix a base seed with a monotonically increasing counter into a well-distributed
 * 32-bit seed, so each decision gets an independent-but-reproducible stream.
 */
export function mixSeed(seed: number, counter: number): number {
  const s = (seed >>> 0) ^ Math.imul(counter + 1, 0x9e3779b1);
  return (s ^ (s >>> 16)) >>> 0;
}

/** Clamp/validate a variance factor to the supported [0, 1] range. */
export function normalizeVariance(variance: number | undefined): number {
  if (typeof variance !== 'number' || Number.isNaN(variance)) return 0;
  return Math.max(0, Math.min(1, variance));
}
