# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

- Never run git commands (add, commit, push, branch, checkout, etc.) — the developer
  reviews every diff and commits manually.
- Work strictly within the scope of the gate/task given in the current prompt. Do not
  build ahead into later gates, and do not touch files outside the stated scope.
- Always run the relevant typecheck and test commands before declaring a gate complete.
  Stop at green and summarize what changed — do not continue to the next gate
  unprompted.

## Commands

Install: `pnpm install` from the repo root (a `preinstall` hook refuses npm/yarn).

Required env vars (`.env`, not committed): `DATABASE_URL` (Postgres/Supabase),
`JWT_ACCESS_SECRET`, `FRONTEND_ORIGIN` (defaults to `http://localhost:5173`).

- `pnpm run dev` — frontend (`:5173`) + API server (`:5000`) together
- `pnpm run dev:web` / `pnpm run dev:api` — just one side
- `pnpm run typecheck` — `tsc --build` for the composite libs (`lib/db`, `lib/api-zod`,
  `lib/api-client-react`), then `tsc --noEmit` for each `artifacts/*` app and `scripts`
- `pnpm --filter <pkg> run typecheck` — typecheck a single package, e.g.
  `pnpm --filter @workspace/api-server run typecheck`
- `pnpm run build` — typecheck, then build every package that has a build script
- `pnpm run test` — runs every package's test script. Only `@workspace/db` and
  `@workspace/api-server` currently have tests, both via Vitest
- Single test file/case: `pnpm --filter @workspace/api-server exec vitest run <path>`,
  or add `-t "<test name>"` to run one test by name
- `pnpm --filter @workspace/db run push` — push schema changes to the dev DB
  (drizzle-kit, diff-based, no migration files). `push-force` skips the confirmation
  prompt
- `pnpm --filter @workspace/api-spec run codegen` — regenerate `@workspace/api-zod`
  and `@workspace/api-client-react` from `lib/api-spec/openapi.yaml`, then
  typechecks the libs

There is no lint script or config in this repo.

`@workspace/api-server`'s tests hit the real dev database directly (no test-DB
isolation) — export `.env` into the shell first
(`set -a && source .env && set +a`) before running them, since Vitest doesn't load
`.env` itself (only the built server does, via `--env-file-if-exists`).

## Architecture

### Monorepo layout

pnpm workspace; packages live under `artifacts/*`, `lib/*`, and `scripts`.

- **`@workspace/api-spec`** (`lib/api-spec/openapi.yaml`) — source of truth for the
  API contract.
- **`@workspace/api-zod`** / **`@workspace/api-client-react`** (`lib/api-zod`,
  `lib/api-client-react`) — generated from the spec via orval. Never hand-edit —
  every file has a "do not edit manually" banner; change the spec and run `codegen`.
- **`@workspace/db`** (`lib/db`) — Drizzle ORM schema + Postgres client/pool,
  exported as `db` / `pool` / table objects from `src/index.ts`. Schema in
  `src/schema/index.ts`; no migration files, changes apply via `drizzle-kit push`.
- **`@workspace/api-server`** (`artifacts/api-server`) — Express 5 API. See below.
- **`@workspace/sakshamscore`** (`artifacts/sakshamscore`) — React 19 + Vite +
  wouter + TanStack Query frontend; the actual product UI.
- **`@workspace/mockup-sandbox`** (`artifacts/mockup-sandbox`) — a separate,
  standalone Vite app for previewing UI mockups dropped into
  `src/components/mockups`. Unrelated to the real app and not part of the deployed
  product.
- **`@workspace/scripts`** (`scripts`) — misc one-off scripts, not part of any app's
  runtime.
- Each app under `artifacts/*` has a `.replit-artifact/artifact.toml` describing its
  Replit deployment (dev/prod run commands, ports, health checks) — that's what
  "artifact" means in the directory naming here.

### Auth

Stateless JWT access token (15 min, httpOnly cookie) + opaque refresh token (7 days,
httpOnly cookie, hashed before storage in `refresh_tokens`, rotated and revoked on
every `/auth/refresh`). `users.role` (`"lender" | "borrower"`) and `users.msmeId`
(fk-by-value to `msme_master.msme_id`, null for lenders) are embedded directly in the
access-token JWT payload (`artifacts/api-server/src/lib/tokens.ts`) — `requireAuth`
never hits the DB per request. `requireRole(role)` gates lender-only routes
(`/assess`, `/card/:id`, `/portfolio`) versus the borrower-only `/me/scorecard`. A
borrower's MSME link is self-declared at signup and validated against the in-memory
dataset (below). There's no separate "bank" tenant entity — `role` is a flat column
on `users`.

### Scoring engine reads an in-memory dataset, not Postgres

Despite the full schema existing (`msme_master`, `gst_returns`, `transactions`,
`epfo`, `obligations`), `/assess`, `/card`, and `/portfolio` currently read a
**synthetic, in-memory, deterministically-seeded dataset**
(`artifacts/api-server/src/data/store.ts`, seed `424242`, 2000 companies
`MSME-000001`..`MSME-002000`), generated fresh in RAM on first request per server
process. DB-backed reads are an explicit, deferred future gate — don't wire real
Postgres reads into `/assess` et al. unless asked.

Pipeline: `scripts/generate-data.ts` (`generateDataset`, pure/seeded) →
`features/index.ts` (`computeFeatures`, raw rows → ~20 numeric features) →
`scoring/index.ts` (`assembleCard`: 5 pre-trained per-pillar logistic regression
models, weighted into an overall score + rating band + coefficient-based reason
codes + confidence + sustainable-EMI + cross-source consistency flags + cashflow
forecast).

Scoring engine is pure TypeScript by design (calibrated logistic regression +
coefficient-based reason codes). Do not introduce Python, SHAP, or scikit-learn —
this decision is locked.

**Gotcha — already caused a production-grade bug once, don't reintroduce it**:
`generate-data.ts` used to also contain a dev-only DB-seeding `main()`, guarded by
an `import.meta.url === process.argv[1]` "only run if invoked directly" check.
esbuild bundles the whole server into a single `dist/index.mjs`, which collapses
every bundled module's `import.meta.url` to the bundle's own path — so that guard
silently evaluated true on *every server startup*, truncating and reseeding the real
DB and then calling `pool.end()` on the same pool the auth routes depend on, causing
seemingly-random 500s on login/signup. The seeding logic now lives in
`scripts/seed-db.ts`, which is never imported by runtime server code (only ever run
directly via `tsx`) — keep it that way. Don't add an "only run if invoked directly"
side-effect guard to any file that's reachable from `features/`, `scoring/`,
`data/`, or `routes/`.
