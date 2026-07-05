/**
 * Dev-only script: score every MSME currently in Postgres and check the
 * result against its known synthetic outcome_label — i.e. does the model,
 * fed by the live DB-backed pipeline (data/store.ts), actually separate
 * defaulters from non-defaulters.
 *
 * Reports AUC / Brier score / expected calibration error / accuracy@0.5 for
 * each pillar and for the blended overall_score, split into:
 *   - held-out: the exact 20% train.ts set aside for calibration (every 5th
 *     MSME by numeric id suffix — same rule as train.ts's `i % 5 === 0`
 *     since generateDataset assigns MSME-000001.. in that same order)
 *   - full: every seeded MSME, included for reference (optimistic/in-sample
 *     for the ~80% the base model was actually fit on)
 *
 * Never imported by runtime server code — invoke directly, e.g.:
 *   set -a && source .env && set +a && npx tsx artifacts/api-server/src/scripts/validate-scores.ts
 */
import { pathToFileURL } from "node:url";
import { pool } from "@workspace/db";
import { getAllRaw } from "../data/store";
import { computeFeatures, type FeatureRecord } from "../features";
import { getModels, type ModelBundle } from "../scoring/train";
import { PILLARS } from "../scoring/pillars";
import { pillarSubScore, scoreMsme } from "../scoring/score";
import { expectedCalibrationError } from "../scoring/logistic";

interface Sample {
  msmeId: string;
  heldOut: boolean;
  y: number; // 1 = non-default (good), matches train.ts's target
  features: FeatureRecord;
}

interface Metrics {
  n: number;
  auc: number;
  brier: number;
  ece: number;
  accuracy: number;
}

function isHeldOut(msmeId: string): boolean {
  const suffix = Number(msmeId.split("-")[1]);
  return (suffix - 1) % 5 === 0;
}

/** Rank-sum (Mann-Whitney U) AUC — ties get the average rank. */
function auc(probs: number[], labels: number[]): number {
  const paired = probs.map((p, i) => ({ p, y: labels[i] }));
  paired.sort((a, b) => a.p - b.p);

  let rankSum = 0;
  let i = 0;
  while (i < paired.length) {
    let j = i;
    while (j < paired.length && paired[j].p === paired[i].p) j++;
    const avgRank = (i + 1 + j) / 2; // 1-indexed average rank across the tie block
    for (let k = i; k < j; k++) if (paired[k].y === 1) rankSum += avgRank;
    i = j;
  }

  const nPos = labels.filter((y) => y === 1).length;
  const nNeg = labels.length - nPos;
  if (nPos === 0 || nNeg === 0) return NaN;
  return (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

function computeMetrics(probs: number[], labels: number[]): Metrics {
  const n = probs.length;
  const brier =
    n === 0
      ? NaN
      : probs.reduce((s, p, i) => s + (p - labels[i]) ** 2, 0) / n;
  const accuracy =
    n === 0
      ? NaN
      : probs.reduce(
          (s, p, i) => s + ((p >= 0.5 ? 1 : 0) === labels[i] ? 1 : 0),
          0,
        ) / n;
  return {
    n,
    auc: auc(probs, labels),
    brier,
    ece: expectedCalibrationError(probs, labels),
    accuracy,
  };
}

function reportRow(label: string, m: Metrics): Record<string, string | number> {
  return {
    metric: label,
    n: m.n,
    AUC: m.auc.toFixed(3),
    Brier: m.brier.toFixed(3),
    ECE: m.ece.toFixed(3),
    "Accuracy@0.5": m.accuracy.toFixed(3),
  };
}

async function loadSamples(): Promise<Sample[]> {
  const { masters, rawById } = await getAllRaw();
  return masters.map((m) => ({
    msmeId: m.msmeId,
    heldOut: isHeldOut(m.msmeId),
    y: 1 - m.outcomeLabel,
    features: computeFeatures(m.msmeId, rawById.get(m.msmeId)!),
  }));
}

function evaluate(
  samples: Sample[],
  models: ModelBundle,
  predict: (f: FeatureRecord) => number,
): { heldOut: Metrics; full: Metrics } {
  const labels = samples.map((s) => s.y);
  const probs = samples.map((s) => predict(s.features) / 100);

  const heldOutIdx = samples
    .map((s, i) => (s.heldOut ? i : -1))
    .filter((i) => i >= 0);

  return {
    heldOut: computeMetrics(
      heldOutIdx.map((i) => probs[i]),
      heldOutIdx.map((i) => labels[i]),
    ),
    full: computeMetrics(probs, labels),
  };
}

export async function main(): Promise<void> {
  const samples = await loadSamples();
  const models = getModels();

  console.log(`Loaded ${samples.length} MSMEs from Postgres.`);
  console.log(
    `Held-out set: ${samples.filter((s) => s.heldOut).length} MSMEs (same split train.ts calibrated Platt scaling on).\n`,
  );

  const rows: Record<string, string | number>[] = [];
  for (const p of PILLARS) {
    const { heldOut, full } = evaluate(samples, models, (f) =>
      pillarSubScore(models.pillars[p.key], f),
    );
    rows.push(reportRow(`${p.label} (held-out)`, heldOut));
    rows.push(reportRow(`${p.label} (full set)`, full));
  }

  const overall = evaluate(samples, models, (f) => scoreMsme(f, models).overall_score);
  rows.push(reportRow("Overall score (held-out)", overall.heldOut));
  rows.push(reportRow("Overall score (full set)", overall.full));

  console.table(rows);
  await pool.end();
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
