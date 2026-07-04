/**
 * Dev-only script: truncate the five Gate 1 tables and bulk-insert a fresh
 * synthetic dataset via Drizzle.
 *
 * Deliberately kept out of generate-data.ts and never imported by any
 * runtime server code — esbuild bundles the whole server into a single
 * dist/index.mjs, which collapses every bundled module's `import.meta.url`
 * to the bundle's own URL. A "run main() only when invoked directly" guard
 * living in a module that's part of that bundle (like generate-data.ts,
 * imported for its pure `generateDataset`) would therefore evaluate true on
 * every server start, silently truncating and reseeding the real database
 * and then closing the shared connection pool out from under the app. This
 * script is only ever invoked directly (e.g. `tsx seed-db.ts`), so it's
 * never a bundling target of the server itself.
 */
import { pathToFileURL } from "node:url";
import {
  msmeMaster,
  gstReturns,
  transactions,
  epfo,
  obligations,
} from "@workspace/db/schema";
import { generateDataset } from "./generate-data";

async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
  chunkSize = 1000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await insert(rows.slice(i, i + chunkSize));
  }
}

export async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-db is a dev-only script; refusing to run in production");
  }

  const { db, pool } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");

  const ds = generateDataset();

  await db.execute(
    sql`TRUNCATE TABLE ${msmeMaster}, ${gstReturns}, ${transactions}, ${epfo}, ${obligations} RESTART IDENTITY CASCADE`,
  );

  await insertChunked(ds.msmeMaster, (c) => db.insert(msmeMaster).values(c));
  await insertChunked(ds.gstReturns, (c) => db.insert(gstReturns).values(c));
  await insertChunked(ds.transactions, (c) => db.insert(transactions).values(c));
  await insertChunked(ds.epfo, (c) => db.insert(epfo).values(c));
  await insertChunked(ds.obligations, (c) => db.insert(obligations).values(c));

  // eslint-disable-next-line no-console
  console.log(
    `Inserted ${ds.msmeMaster.length} MSMEs: ` +
      `${ds.gstReturns.length} gst_returns, ${ds.transactions.length} transactions, ` +
      `${ds.epfo.length} epfo, ${ds.obligations.length} obligations`,
  );

  await pool.end();
}

// Run only when invoked directly (e.g. `tsx seed-db.ts`), never on import.
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
