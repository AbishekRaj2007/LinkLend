// Seed Postgres with the deterministic synthetic dataset. Requires DATABASE_URL
// and a pushed schema (pnpm --filter @workspace/db run push). Run with:
//   pnpm --filter @workspace/api-server run seed

import {
  db,
  pool,
  msmeMaster,
  gstReturns,
  transactions,
  epfo,
  obligations,
} from "@workspace/db";
import { generateDataset } from "../synthetic/generate";

const SEED = 42;
const N = 2000;
const BATCH = 500;

async function insertInBatches<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    await insert(rows.slice(i, i + BATCH));
  }
}

async function main(): Promise<void> {
  const dataset = generateDataset({ n: N, seed: SEED });

  console.log(`Clearing existing rows…`);
  await db.delete(gstReturns);
  await db.delete(transactions);
  await db.delete(epfo);
  await db.delete(obligations);
  await db.delete(msmeMaster);

  const masters = dataset.map((b) => b.master);
  const gst = dataset.flatMap((b) => b.gst.map((g) => ({ ...g, msmeId: b.master.msmeId })));
  const txns = dataset.flatMap((b) =>
    b.transactions.map((t) => ({ ...t, msmeId: b.master.msmeId })),
  );
  const epfoRows = dataset.flatMap((b) => b.epfo.map((e) => ({ ...e, msmeId: b.master.msmeId })));
  const obRows = dataset
    .filter((b) => b.obligation !== null)
    .map((b) => ({ ...b.obligation!, msmeId: b.master.msmeId }));

  console.log(`Inserting ${masters.length} MSMEs…`);
  await insertInBatches(masters, (c) => db.insert(msmeMaster).values(c));
  console.log(`Inserting ${gst.length} GST rows…`);
  await insertInBatches(gst, (c) => db.insert(gstReturns).values(c));
  console.log(`Inserting ${txns.length} transactions…`);
  await insertInBatches(txns, (c) => db.insert(transactions).values(c));
  console.log(`Inserting ${epfoRows.length} EPFO rows…`);
  await insertInBatches(epfoRows, (c) => db.insert(epfo).values(c));
  console.log(`Inserting ${obRows.length} obligation rows…`);
  await insertInBatches(obRows, (c) => db.insert(obligations).values(c));

  console.log("Done.");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
