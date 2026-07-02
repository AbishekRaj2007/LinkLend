/**
 * Train the five calibrated per-pillar logistic-regression models from the Gate 1
 * synthetic dataset and persist them as JSON under artifacts/api-server/models/.
 *
 * Target is y = 1 - outcome_label (i.e. P(non-default)), so a higher calibrated
 * probability maps directly to a higher 0-100 sub-score.
 *
 * `getModels()` is the runtime accessor: it loads the JSON artifact if present,
 * otherwise it trains the (deterministic, seeded) models in memory and caches
 * them — so scoring works in tests without a pre-committed model file.
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

import { generateDataset } from "../scripts/generate-data";
import { computeFeatures, groupRawByMsme } from "../features";
import { PILLARS, featureVector } from "./pillars";
import {
  columnStats,
  standardizeRow,
  trainLogistic,
  sigmoid,
  dot,
  expectedCalibrationError,
  fitPlatt,
  type Calibration,
} from "./logistic";

const DEFAULT_SEED = 424242;
const DEFAULT_COUNT = 2000;
// Apply Platt recalibration only when the base model is meaningfully
// miscalibrated on held-out data; below this ECE we keep the raw probabilities.
const ECE_THRESHOLD = 0.02;

export interface PillarModel {
  key: string;
  label: string;
  featureNames: string[];
  means: number[];
  stds: number[];
  weights: number[];
  bias: number;
  /** Platt recalibration params, or null when the base model was well-calibrated. */
  calibration: Calibration | null;
}

export interface ModelBundle {
  seed: number;
  trainedAt: string;
  pillars: Record<string, PillarModel>;
}

function trainPillar(
  key: string,
  label: string,
  featureNames: string[],
  X: number[][],
  y: number[],
): PillarModel {
  const { means, stds } = columnStats(X);
  const Xstd = X.map((r) => standardizeRow(r, means, stds));

  // Deterministic 80/20 split (every 5th sample held out for calibration).
  const trainX: number[][] = [];
  const trainY: number[] = [];
  const calZinputs: number[][] = [];
  const calY: number[] = [];
  for (let i = 0; i < Xstd.length; i++) {
    if (i % 5 === 0) {
      calZinputs.push(Xstd[i]);
      calY.push(y[i]);
    } else {
      trainX.push(Xstd[i]);
      trainY.push(y[i]);
    }
  }

  // Base model on the train split → held-out logits → reliability check.
  const cv = trainLogistic(trainX, trainY);
  const calZ = calZinputs.map((x) => dot(cv.weights, x) + cv.bias);
  const calProbs = calZ.map((z) => sigmoid(z));
  const ece = expectedCalibrationError(calProbs, calY);
  const calibration = ece > ECE_THRESHOLD ? fitPlatt(calZ, calY) : null;

  // Refit the base model on ALL data for the deployed coefficients.
  const base = trainLogistic(Xstd, y);

  return {
    key,
    label,
    featureNames,
    means,
    stds,
    weights: base.weights,
    bias: base.bias,
    calibration,
  };
}

export function trainModels(
  seed = DEFAULT_SEED,
  count = DEFAULT_COUNT,
): ModelBundle {
  const ds = generateDataset({ seed, count });
  const rawById = groupRawByMsme(ds);

  const samples = ds.msmeMaster.map((m) => ({
    features: computeFeatures(m.msmeId, rawById.get(m.msmeId)!),
    y: 1 - m.outcomeLabel, // 1 = non-default (good)
  }));
  const y = samples.map((s) => s.y);

  const pillars: Record<string, PillarModel> = {};
  for (const p of PILLARS) {
    const X = samples.map((s) => featureVector(s.features, p.features));
    pillars[p.key] = trainPillar(p.key, p.label, p.features, X, y);
  }

  return { seed, trainedAt: new Date().toISOString(), pillars };
}

// --- Persistence + runtime accessor -----------------------------------------

function modelsPath(): string {
  // artifacts/api-server/models/pillars.json (this file lives in src/scoring/).
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "models", "pillars.json");
}

let cached: ModelBundle | null = null;

export function getModels(): ModelBundle {
  if (cached) return cached;
  const p = modelsPath();
  if (fs.existsSync(p)) {
    cached = JSON.parse(fs.readFileSync(p, "utf8")) as ModelBundle;
    return cached;
  }
  cached = trainModels();
  return cached;
}

export function saveModels(bundle: ModelBundle): string {
  const p = modelsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(bundle, null, 2));
  return p;
}

async function main(): Promise<void> {
  const bundle = trainModels();
  const p = saveModels(bundle);
  // eslint-disable-next-line no-console
  console.log(
    `Trained ${Object.keys(bundle.pillars).length} pillar models -> ${p}`,
  );
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
