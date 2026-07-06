# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm install` — install all workspace dependencies
- `pnpm run dev` — run the frontend (port 5173) and API server (port 5000) together
- `pnpm run dev:web` — run only the frontend (`sakshamscore`)
- `pnpm run dev:api` — run only the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run train` / `run validate` — refit / evaluate the scoring models (no DB needed)
- `pnpm --filter @workspace/api-server run seed` — seed the dev Postgres DB
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- `/assess`, `/card`, `/me/scorecard`, and `/portfolio` read the real Postgres tables via `artifacts/api-server/src/data/store.ts`. The scoring core itself (features, model evaluation, reason codes, confidence, forecast) is pure, DB-independent TypeScript operating on the `MsmeBundle` domain type (`src/types.ts`); training/validation regenerate a deterministic synthetic dataset in memory (`src/synthetic/generate.ts`) rather than touching the DB. See CLAUDE.md for the full pipeline.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
