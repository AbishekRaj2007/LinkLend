// Selects where MSME data comes from. When DATABASE_URL is set we read Postgres
// (data/store.ts, imported lazily so its @workspace/db dependency — which throws
// without DATABASE_URL — is never loaded in synthetic mode). Otherwise we serve
// the deterministic synthetic dataset straight from the generator, so the whole
// stack runs end-to-end with zero setup for demos.

import type { MsmeBundle } from "../types";
import { generateDataset } from "../synthetic/generate";

export interface DataSource {
  mode: "postgres" | "synthetic";
  listMsmeIds(): Promise<string[]>;
  loadBundle(msmeId: string): Promise<MsmeBundle | null>;
}

const SYNTHETIC_N = Number(process.env["SYNTHETIC_N"] ?? 300);
const SYNTHETIC_SEED = Number(process.env["SYNTHETIC_SEED"] ?? 42);

function makeSyntheticSource(): DataSource {
  const dataset = generateDataset({ n: SYNTHETIC_N, seed: SYNTHETIC_SEED });
  const byId = new Map<string, MsmeBundle>();
  for (const b of dataset) byId.set(b.master.msmeId, b);
  const ids = [...byId.keys()];
  return {
    mode: "synthetic",
    listMsmeIds: async () => ids,
    loadBundle: async (id) => byId.get(id) ?? null,
  };
}

let cached: Promise<DataSource> | null = null;

export function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  cached = (async () => {
    if (process.env["DATABASE_URL"]) {
      const store = await import("./store");
      return {
        mode: "postgres" as const,
        listMsmeIds: store.listMsmeIds,
        loadBundle: store.loadBundle,
      };
    }
    return makeSyntheticSource();
  })();
  return cached;
}
