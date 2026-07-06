# Project instructions for Claude Code

## Workflow rules
- Never run git commands (add, commit, push, branch, checkout, etc.) — the developer
  reviews every diff and commits manually.
- Always run the relevant typecheck and test commands before declaring work complete.
  Stop at green and summarize what changed.
- Keep changes scoped to what the current prompt asks for; don't touch unrelated files.

## Monorepo layout (pnpm workspace)
- `@workspace/api-server` (`artifacts/api-server`, Express 5) — API **and** the scoring engine.
- `@workspace/sakshamscore` (`artifacts/sakshamscore`, React + Vite) — lender-facing dashboard.
- `@workspace/db` (`lib/db`, Drizzle ORM + Postgres) — the five raw tables (schema is the
  source of truth: `lib/db/src/schema/index.ts`).
- `@workspace/api-spec` (`lib/api-spec`, OpenAPI source of truth), `@workspace/api-zod`
  (`lib/api-zod`, generated Zod — never hand-edit), `@workspace/api-client-react`
  (generated hooks — never hand-edit).
- `@workspace/mockup-sandbox` (`artifacts/mockup-sandbox`) — component design sandbox.

## Scoring engine (`artifacts/api-server/src/`)
- Pure TypeScript, DB-independent. Layout: `ml/` (seeded RNG, logistic regression + Platt,
  metrics), `synthetic/generate.ts` (deterministic latent-health dataset), `features/`
  (`computeFeatures`; `features/catalog.ts` is the single source of truth for feature
  names, pillar membership, weights, neutral defaults), `scoring/` (pillar eval, blended
  score/band, exact coefficient-based reason codes, confidence, consistency flag, forecast,
  repayment), `data/` (Postgres store + source selector), `lib/groq.ts` (AI narration),
  `routes/score.ts` (endpoints), `scripts/` (train, validate, seed).
- Trained coefficients live in `scoring/model-artifact.generated.ts` — **do not hand-edit**;
  regenerate with the `train` script.

## Locked design decisions (do not revert without being asked)
- Scoring core is **pure TypeScript** — calibrated logistic regression + coefficient-based
  reason codes. No Python, SHAP, or scikit-learn.
- The overall score is a **fixed weighted blend** (25/30/20/15/10), not a learned meta-model.
  Pillars are individually Platt-calibrated; treat `overallScore/100` as a risk ranking,
  not a literal probability.
- **AI is quarantined to narration** (`lib/groq.ts`) — it only describes an already-computed
  scorecard, never recomputes or re-ranks.
- Training/validation are **DB-independent** (regenerate the seeded dataset in-memory).
- The API has a **synthetic fallback**: with no `DATABASE_URL` it serves the in-memory
  synthetic dataset, so `pnpm run dev` works end-to-end with zero setup. Postgres is used
  only when `DATABASE_URL` is set (+ the `seed` script).
- Replit-specific config has been removed; do not re-add `@replit/*` plugins or `.replit*`.

## Commands
- `pnpm run dev` — frontend (4174) + API (5000) together; the frontend proxies `/api` → 5000.
- `pnpm run typecheck` / `pnpm run test` — full workspace typecheck / tests.
- `pnpm --filter @workspace/api-server run train` — refit pillar models, regenerate the
  coefficient artifact (no DB).
- `pnpm --filter @workspace/api-server run validate` — AUC / Brier / ECE / accuracy (no DB).
- `pnpm --filter @workspace/api-server run seed` — seed Postgres (needs `DATABASE_URL` + pushed schema).
- Optional env: `GROQ_API_KEY` enables LLM credit-memo narration (deterministic template otherwise).
