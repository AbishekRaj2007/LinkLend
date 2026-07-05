import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Routes now read through to a remote Postgres pooler (Supabase) instead
    // of an in-memory dataset; round trips routinely exceed vitest's 5s
    // default once several test files hit the DB concurrently.
    testTimeout: 20_000,
    // Each test file spins up its own connection pool against the same
    // remote Supabase pooler; running files concurrently was exhausting the
    // pooler's connection budget and causing sporadic timeouts/500s.
    fileParallelism: false,
  },
});
