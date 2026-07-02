/**
 * Minimal, dependency-free logistic regression: full-batch gradient descent with
 * L2 regularization, plus feature standardization, a reliability (ECE) check, and
 * Platt-style 1D probability recalibration. Deterministic (no RNG), so trained
 * artifacts are fully reproducible.
 */

export function sigmoid(z: number): number {
  const c = Math.max(-35, Math.min(35, z));
  return 1 / (1 + Math.exp(-c));
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export interface ColumnStats {
  means: number[];
  stds: number[];
}

/** Per-column mean/std; a ~0 std is floored to 1 so standardization stays finite. */
export function columnStats(X: number[][]): ColumnStats {
  const n = X.length;
  const d = n > 0 ? X[0].length : 0;
  const means = new Array<number>(d).fill(0);
  const stds = new Array<number>(d).fill(0);
  if (n === 0) return { means, stds: stds.map(() => 1) };

  for (const row of X) for (let j = 0; j < d; j++) means[j] += row[j];
  for (let j = 0; j < d; j++) means[j] /= n;

  for (const row of X)
    for (let j = 0; j < d; j++) stds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < d; j++) {
    const s = Math.sqrt(stds[j] / n);
    stds[j] = s < 1e-9 ? 1 : s;
  }
  return { means, stds };
}

export function standardizeRow(
  x: number[],
  means: number[],
  stds: number[],
): number[] {
  return x.map((v, j) => (v - means[j]) / stds[j]);
}

export interface LogisticModel {
  weights: number[];
  bias: number;
}

export interface TrainOptions {
  lr?: number;
  epochs?: number;
  l2?: number;
}

/** Train logistic regression on already-standardized X. */
export function trainLogistic(
  X: number[][],
  y: number[],
  opts: TrainOptions = {},
): LogisticModel {
  const lr = opts.lr ?? 0.1;
  const epochs = opts.epochs ?? 400;
  const l2 = opts.l2 ?? 1e-2;
  const n = X.length;
  const d = n > 0 ? X[0].length : 0;
  const weights = new Array<number>(d).fill(0);
  let bias = 0;
  if (n === 0) return { weights, bias };

  for (let e = 0; e < epochs; e++) {
    const gw = new Array<number>(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(dot(weights, X[i]) + bias);
      const err = p - y[i];
      for (let j = 0; j < d; j++) gw[j] += err * X[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) {
      weights[j] -= lr * (gw[j] / n + l2 * weights[j]);
    }
    bias -= lr * (gb / n);
  }
  return { weights, bias };
}

/**
 * Expected Calibration Error over `bins` equal-width probability buckets — used
 * to decide whether Platt recalibration is actually needed.
 */
export function expectedCalibrationError(
  probs: number[],
  y: number[],
  bins = 10,
): number {
  const n = probs.length;
  if (n === 0) return 0;
  let ece = 0;
  for (let b = 0; b < bins; b++) {
    const lo = b / bins;
    const hi = (b + 1) / bins;
    let count = 0;
    let sumP = 0;
    let sumY = 0;
    for (let i = 0; i < n; i++) {
      const p = probs[i];
      if (p >= lo && (p < hi || (b === bins - 1 && p <= hi))) {
        count++;
        sumP += p;
        sumY += y[i];
      }
    }
    if (count > 0) ece += (count / n) * Math.abs(sumY / count - sumP / count);
  }
  return ece;
}

export interface Calibration {
  a: number;
  b: number;
}

/**
 * Fit a 1D Platt recalibration mapping a decision value (logit) to a calibrated
 * probability: p = sigmoid(a * z + b).
 */
export function fitPlatt(z: number[], y: number[]): Calibration {
  const model = trainLogistic(
    z.map((v) => [v]),
    y,
    { lr: 0.1, epochs: 300, l2: 0 },
  );
  return { a: model.weights[0], b: model.bias };
}
