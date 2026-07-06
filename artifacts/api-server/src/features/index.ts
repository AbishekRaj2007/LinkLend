import type { MsmeBundle } from "../types";
import { computeFeatureVector } from "./compute";
import { computeCompleteness, type Completeness } from "./completeness";
import { computeConsistency, type ConsistencyRatios } from "./consistency";
import type { FeatureVector } from "./catalog";

export * from "./catalog";
export type { Completeness } from "./completeness";
export type { ConsistencyRatios } from "./consistency";

/** The full feature record for one MSME: model inputs + coverage + fraud ratios. */
export interface FeatureRecord {
  msmeId: string;
  features: FeatureVector;
  completeness: Completeness;
  consistency: ConsistencyRatios;
}

export function computeFeatures(bundle: MsmeBundle): FeatureRecord {
  return {
    msmeId: bundle.master.msmeId,
    features: computeFeatureVector(bundle),
    completeness: computeCompleteness(bundle),
    consistency: computeConsistency(bundle),
  };
}
