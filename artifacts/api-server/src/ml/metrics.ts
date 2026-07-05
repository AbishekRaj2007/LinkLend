// Classification metrics used by the validation script. Labels are in {0,1}
// (1 == non-default / "good"); `probs` are P(label == 1).

/** Area under the ROC curve, via the rank-sum (Mann–Whitney U) identity. */
export function auc(probs: number[], labels: number[]): number {
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    (labels[i] === 1 ? pos : neg).push(probs[i]!);
  }
  if (pos.length === 0 || neg.length === 0) return 0.5;

  // Rank all scores; ties get the average rank.
  const all = probs
    .map((p, i) => ({ p, y: labels[i]! }))
    .sort((x, y) => x.p - y.p);

  const ranks = new Array<number>(all.length);
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j < all.length - 1 && all[j + 1]!.p === all[i]!.p) j++;
    const avgRank = (i + j) / 2 + 1; // ranks are 1-based
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    i = j + 1;
  }

  let rankSumPos = 0;
  for (let k = 0; k < all.length; k++) {
    if (all[k]!.y === 1) rankSumPos += ranks[k]!;
  }
  const nPos = pos.length;
  const nNeg = neg.length;
  return (rankSumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/** Mean squared error between probability and label. Lower is better. */
export function brier(probs: number[], labels: number[]): number {
  if (probs.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < probs.length; i++) {
    const d = probs[i]! - labels[i]!;
    s += d * d;
  }
  return s / probs.length;
}

/** Expected Calibration Error over equal-width bins. Lower == better calibrated. */
export function ece(probs: number[], labels: number[], bins = 10): number {
  const n = probs.length;
  if (n === 0) return 0;
  const count = new Array<number>(bins).fill(0);
  const confSum = new Array<number>(bins).fill(0);
  const accSum = new Array<number>(bins).fill(0);

  for (let i = 0; i < n; i++) {
    const p = Math.min(0.999999, Math.max(0, probs[i]!));
    const b = Math.min(bins - 1, Math.floor(p * bins));
    count[b]! += 1;
    confSum[b]! += p;
    accSum[b]! += labels[i]!;
  }

  let total = 0;
  for (let b = 0; b < bins; b++) {
    if (count[b] === 0) continue;
    const conf = confSum[b]! / count[b]!;
    const acc = accSum[b]! / count[b]!;
    total += (count[b]! / n) * Math.abs(conf - acc);
  }
  return total;
}

/** Fraction correct at a 0.5 decision threshold. */
export function accuracyAt(probs: number[], labels: number[], threshold = 0.5): number {
  if (probs.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < probs.length; i++) {
    const pred = probs[i]! >= threshold ? 1 : 0;
    if (pred === labels[i]) correct++;
  }
  return correct / probs.length;
}
