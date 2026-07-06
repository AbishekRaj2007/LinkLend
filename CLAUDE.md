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
`GROQ_API_KEY` is required only for the AI features (credit memos, borrower coach,
scorecard Q&A, document ingestion) — the app runs without it, but those endpoints 500.
The AI layer uses **Groq** (OpenAI-compatible, `groq-sdk`); Claude/Anthropic and OpenAI
are not used. The LLM only explains an already-computed scorecard — it never computes or
alters a score (the scoring engine stays pure deterministic TS, see below).

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
- `pnpm --filter @workspace/api-server run train` — refit the 5 pillar models on
  the deterministic synthetic dataset and rewrite `scoring/model-artifact.generated.ts`
  (no DB needed)
- `pnpm --filter @workspace/api-server run validate` — report AUC/Brier/ECE/accuracy
  for the current model artifact (no DB needed)
- `pnpm --filter @workspace/api-server run seed` — truncate and reseed the real
  Postgres dev DB via `scripts/seed-db.ts` (needs `DATABASE_URL` + pushed schema)

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

### Scoring engine reads Postgres, and is pure TypeScript internally

`/assess`, `/card`, `/me/scorecard`, and `/portfolio` read the real
`msme_master`/`gst_returns`/`transactions`/`epfo`/`obligations` tables via
`artifacts/api-server/src/data/store.ts`, which maps Drizzle rows into the
DB-independent `MsmeBundle` shape (`src/types.ts`) the scoring core consumes.
Point reads (`loadBundle`) back `/assess` and `/me/scorecard`; a cached bulk
read (`getAllBundles`) backs `/portfolio` (the full five-table pull is ~175k
rows — fine once, too slow to repeat per request).

Pipeline: `data/store.ts` (Postgres → `MsmeBundle`) → `features/index.ts`
(`computeFeatures`: `features/compute.ts` builds the numeric feature vector
against the single source of truth in `features/catalog.ts` — feature names,
pillar membership/weights, neutral defaults for thin files — plus
`completeness.ts` and `consistency.ts` for coverage/fraud signals) →
`scoring/index.ts` (`assembleCard`: evaluates the 5 pre-trained, Platt-calibrated
per-pillar logistic regression models in `scoring/model.ts` against the trained
coefficients in `scoring/model-artifact.generated.ts`, blends them into an
overall score + rating band, adds coefficient-based reason codes
(`scoring/explain.ts`), confidence (`scoring/confidence.ts`), sustainable EMI +
cashflow forecast (`scoring/repayment.ts`/`forecast.ts`), and the cross-source
consistency flag (`scoring/consistency.ts`) — then maps all of it into the
exact `Card` shape the API contract requires, including the plain-language
reason phrasing).

The logistic regression + Platt scaling math itself lives in `src/ml/`
(`logreg.ts`, `rng.ts`, `metrics.ts`) — dependency-free, deterministic, no
Python/SHAP/scikit-learn (this decision is locked). Training and validation are
**DB-independent**: `src/synthetic/generate.ts` regenerates a deterministic
in-memory dataset (different from, and not to be confused with, the Postgres
seed data below), `pnpm --filter @workspace/api-server run train` refits the
5 pillar models against it and rewrites `model-artifact.generated.ts`, and
`run validate` reports AUC/Brier/ECE/accuracy. Re-run `train` (and review the
diff) if you change `features/catalog.ts` or `features/compute.ts`.

Seeding the real Postgres dev DB is a separate, unrelated pipeline: `run seed`
invokes `scripts/seed-db.ts`, which uses `scripts/generate-data.ts`'s
`generateDataset` (seed `424242`, 2000 companies `MSME-000001`..`MSME-002000`) —
this is what the route tests' `MSME-000001`-style ids assume is already seeded.

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
