# Project instructions for Claude Code

- Never run git commands (add, commit, push, branch, checkout, etc.) — the developer
  reviews every diff and commits manually.
- Work strictly within the scope of the gate/task given in the current prompt. Do not
  build ahead into later gates, and do not touch files outside the stated scope.
- Always run the relevant typecheck and test commands before declaring a gate complete.
  Stop at green and summarize what changed — do not continue to the next gate
  unprompted.
- This is a pnpm workspace monorepo. Packages: @workspace/api-server
  (artifacts/api-server, Express 5), @workspace/db (lib/db, Drizzle ORM + Postgres),
  @workspace/api-spec (lib/api-spec, OpenAPI source of truth), @workspace/api-zod
  (lib/api-zod, generated Zod schemas — never hand-edit), @workspace/api-client-react
  (generated hooks — never hand-edit), @workspace/sakshamscore
  (artifacts/sakshamscore, React + Vite frontend).
- Scoring engine is pure TypeScript by design (calibrated logistic regression +
  coefficient-based reason codes). Do not introduce Python, SHAP, or scikit-learn —
  this decision is locked.
