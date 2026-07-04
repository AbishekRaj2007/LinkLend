import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
  // Recycle idle connections proactively — Supabase's pooler (Supavisor)
  // closes idle connections from its side, and without this a checked-in
  // client can go stale and every query on it fails until the process
  // restarts.
  idleTimeoutMillis: 30_000,
});

// Without this handler, an idle client erroring becomes an unhandled
// 'error' event on the pool, which crashes the process (node-postgres
// docs). Logging it here also gives visibility when the pooler drops a
// connection instead of a silent, unexplained per-request failure.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
