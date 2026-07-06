// Deterministic, seedable PRNG utilities.
//
// The whole synthetic pipeline (data generation, train/validate splits) must be
// reproducible so that trained coefficients and reported metrics are stable
// across runs. We therefore never touch Math.random(); every random draw flows
// through a seeded generator created here.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  uniform(min: number, max: number): number;
  /** Standard-normal draw (Box–Muller). */
  gaussian(mean?: number, std?: number): number;
  /** Bernoulli(p) -> 0 | 1. */
  bernoulli(p: number): number;
  /** Uniformly pick one element. */
  pick<T>(items: readonly T[]): T;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
}

/**
 * mulberry32 — a tiny, fast, well-distributed 32-bit PRNG. Good enough for
 * synthetic data; not cryptographic.
 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const uniform = (min: number, max: number): number => min + (max - min) * next();

  const gaussian = (mean = 0, std = 1): number => {
    // Box–Muller; guard against log(0).
    let u1 = next();
    const u2 = next();
    if (u1 < 1e-12) u1 = 1e-12;
    const mag = Math.sqrt(-2 * Math.log(u1));
    return mean + std * mag * Math.cos(2 * Math.PI * u2);
  };

  const bernoulli = (p: number): number => (next() < p ? 1 : 0);

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("pick() on empty array");
    return items[Math.floor(next() * items.length)]!;
  };

  const int = (min: number, max: number): number =>
    Math.floor(uniform(min, max + 1));

  return { next, uniform, gaussian, bernoulli, pick, int };
}
