// Pure-TypeScript logistic regression: standardization, batch gradient-descent
// fitting with L2 regularization, and Platt scaling. No Python, no scikit-learn —
// this is the locked design decision for an auditable, dependency-light scorer.

export interface Standardizer {
  means: number[];
  stds: number[];
}

/** Column-wise mean/std over a design matrix. Zero-variance columns get std=1. */
export function fitStandardizer(rows: number[][]): Standardizer {
  const n = rows.length;
  const d = n > 0 ? rows[0]!.length : 0;
  const means = new Array<number>(d).fill(0);
  const stds = new Array<number>(d).fill(0);
  if (n === 0) return { means, stds: stds.map(() => 1) };

  for (const row of rows) {
    for (let j = 0; j < d; j++) means[j]! += row[j]!;
  }
  for (let j = 0; j < d; j++) means[j]! /= n;

  for (const row of rows) {
    for (let j = 0; j < d; j++) {
      const dev = row[j]! - means[j]!;
      stds[j]! += dev * dev;
    }
  }
  for (let j = 0; j < d; j++) {
    stds[j] = Math.sqrt(stds[j]! / n);
    if (!(stds[j]! > 1e-9)) stds[j] = 1; // guard zero / NaN variance
  }
  return { means, stds };
}

export function standardizeRow(row: number[], s: Standardizer): number[] {
  return row.map((v, j) => (v - s.means[j]!) / s.stds[j]!);
}

export function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

export interface LogRegModel {
  weights: number[];
  bias: number;
}

export interface FitOptions {
  lr?: number;
  epochs?: number;
  l2?: number;
}

/**
 * Fit logistic regression on already-standardized rows via full-batch gradient
 * descent. `labels` are in {0,1} (here: 1 == non-default / "good").
 */
export function fitLogReg(
  standardizedRows: number[][],
  labels: number[],
  opts: FitOptions = {},
): LogRegModel {
  const lr = opts.lr ?? 0.1;
  const epochs = opts.epochs ?? 400;
  const l2 = opts.l2 ?? 1e-3;

  const n = standardizedRows.length;
  const d = n > 0 ? standardizedRows[0]!.length : 0;
  const weights = new Array<number>(d).fill(0);
  let bias = 0;
  if (n === 0) return { weights, bias };

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array<number>(d).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      const row = standardizedRows[i]!;
      let z = bias;
      for (let j = 0; j < d; j++) z += weights[j]! * row[j]!;
      const err = sigmoid(z) - labels[i]!; // dL/dz
      for (let j = 0; j < d; j++) gradW[j]! += err * row[j]!;
      gradB += err;
    }

    for (let j = 0; j < d; j++) {
      weights[j]! -= lr * (gradW[j]! / n + l2 * weights[j]!);
    }
    bias -= lr * (gradB / n);
  }

  return { weights, bias };
}

/** Raw linear score z = w·x + b on a standardized row. */
export function linear(model: LogRegModel, standardizedRow: number[]): number {
  let z = model.bias;
  for (let j = 0; j < standardizedRow.length; j++) {
    z += model.weights[j]! * standardizedRow[j]!;
  }
  return z;
}

export function predictProba(model: LogRegModel, standardizedRow: number[]): number {
  return sigmoid(linear(model, standardizedRow));
}

// --- Platt scaling ---------------------------------------------------------
// Maps a model's raw logits z to calibrated probabilities via sigmoid(a*z + b),
// where (a, b) are fit by 1-D logistic regression of labels on z.

export interface PlattScaler {
  a: number;
  b: number;
}

export function fitPlatt(
  logits: number[],
  labels: number[],
  opts: FitOptions = {},
): PlattScaler {
  const lr = opts.lr ?? 0.05;
  const epochs = opts.epochs ?? 600;
  const n = logits.length;
  let a = 1;
  let b = 0;
  if (n === 0) return { a, b };

  for (let epoch = 0; epoch < epochs; epoch++) {
    let gradA = 0;
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const z = a * logits[i]! + b;
      const err = sigmoid(z) - labels[i]!;
      gradA += err * logits[i]!;
      gradB += err;
    }
    a -= lr * (gradA / n);
    b -= lr * (gradB / n);
  }
  return { a, b };
}

export function applyPlatt(scaler: PlattScaler, logit: number): number {
  return sigmoid(scaler.a * logit + scaler.b);
}
