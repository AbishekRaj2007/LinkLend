# SakshamScore — Score Calculation & Methodology

How LinkLend scores an MSME without a credit bureau history or collateral, exactly
how each number in the scorecard is computed, and what's novel about the approach.

## The problem this solves

Traditional credit scoring needs two things this product deliberately doesn't have:
**prior loan history** (a bureau file) and **collateral** (an asset to seize on default).
Most Indian MSMEs applying for their first formal loan have neither — that's what
`ntc_ntb_flag` ("new-to-credit / new-to-bank") marks in the dataset. Instead of those
two inputs, the score is built entirely from **operational exhaust** the business
already produces: GST filings, EPFO payroll records, and its own bank transactions.
The core idea: does this business's real financial footprint look like the footprint
of businesses that historically repaid, and do its self-declared numbers agree with
what its bank account actually shows?

## Data sources

Four raw tables per MSME (`artifacts/api-server/src/data/store.ts` reads them from
Postgres; `msme_master`, `gst_returns`, `transactions`, `epfo`, `obligations`):

| Source | What it captures | Bureau/collateral equivalent it replaces |
|---|---|---|
| GST returns | Turnover, tax paid, invoice count, filing timeliness | Business health / revenue history |
| Bank transactions | Every credit/debit, running balance | Payment history |
| EPFO records | Employee count, contribution amount, on-time payment | Formal-sector compliance signal |
| Obligations | Existing EMIs, bounce count | Existing debt burden |

## Feature engineering

`features/*.ts` turns those raw rows into ~20 numeric features per MSME
(`computeFeatures` in `artifacts/api-server/src/features/index.ts`). All proportions
are fractions in `[0, 1]`; ratios and CVs are non-negative and capped so they stay
finite. Thin-file MSMEs (missing a source, short history) never error — affected
features fall back to documented neutral defaults, and the gap is recorded in a
`completeness` vector instead (see **Confidence**, below).

## The five pillars

Each pillar is its own small logistic regression, trained only on its own feature
subset (`scoring/pillars.ts`). Weights are fixed and sum to 1:

| Pillar | Weight | Features | What it measures instead of bureau/collateral |
|---|---|---|---|
| **Business Vitality** | 25% | `turnover6moTrend`, `turnoverCAGR`, `turnoverVolatilityCV`, `invoiceCountTrend`, `seasonalityIndex` | Is the business growing or shrinking right now — a bureau has zero visibility into *current* trajectory |
| **Cashflow Health** | 30% | `avgMonthlyNetInflow`, `inflowVolatilityCV`, `runwayMonths`, `negativeBalanceDays`, `dscrProxy` | Can the bank account actually service debt — the direct substitute for collateral-backed "ability to repay" |
| **Formalisation & Compliance** | 20% | `gstOnTimeFilingPct`, `monthsFiledOverMonthsActive`, `epfoActiveFlag`, `epfoContributionConsistency` | Does it meet statutory obligations on time — repayment discipline, verified via government filings |
| **Banking Behaviour** | 15% | `bounceRate`, `avgBalanceBuffer`, `balanceStabilityCV`, `minBalanceEventCount` | Does it bounce payments or run low — literal payment history, sourced from the bank feed instead of a loan bureau |
| **Obligations & Leverage** | 10% | `obligationToInflowRatio`, `obligationCount` | How much of real cashflow is already committed — "debt relative to actual money coming in," not appraised asset value |

## Scoring mechanics

**Per-pillar sub-score** (`scoring/score.ts: pillarSubScore`):
1. Standardize the pillar's feature vector using that model's stored per-feature `means`/`stds`.
2. `z = dot(weights, standardized_features) + bias`.
3. `probability = sigmoid(z)`, or `sigmoid(a·z + b)` if the pillar needed Platt
   recalibration (see **Validation**) — this is the model's calibrated `P(non-default)`.
4. Sub-score = `round(probability × 100)`, clamped to `[0, 100]`.

**Overall score** (`scoring/score.ts: scoreMsme`):
```
overall_score = round( Σ pillar.weight × pillar.subScore )   // clamped [0, 100]
```
It's a **fixed weighted blend**, not a learned meta-model — a deliberate v1 choice
(see Limitations).

**Rating bands** (`ratingBand`): `≥ 75` → Low Risk · `60–74` → Moderate Risk · `< 60` → High Risk.

## Reason codes — exact, not approximated

Most "explainable AI" credit products bolt SHAP/LIME onto a black-box model — an
approximation of an approximation. Here (`scoring/explain.ts`), each reason code is
the literal `coefficient × standardized-feature-value` contribution from the actual
deployed logistic regression: mathematically exact, reproducible, and auditable, not
estimated. The top 3 contributions per pillar (by absolute value) become that
pillar's `reasons`; the two most-adverse contributions across all pillars become the
scorecard's overall explanation. (`epfoActiveFlag` is excluded from reason-code
selection — its coefficient sign is entangled with `epfoContributionConsistency` via
collinearity in training, which would otherwise mislabel its direction.)

## Confidence — tied to data completeness, not just accuracy

`scoring/confidence.ts` maps the feature record's `completeness` vector (which
sources are present, months of history, a `coverageScore`) to a `level`
(Low/Medium/High) and a `raise_by` string. Instead of a binary approve/reject when
data is thin, the borrower gets a concrete next step — e.g. "adding EPFO contribution
records would raise confidence to High" — turning a data gap into a to-do list rather
than a rejection.

## Cross-source consistency — the fraud/verification check

Collateral normally forces "skin in the game" and gives a lender a fallback. Here
that role is played by two consistency ratios computed across sources
(`features: consistency.ts`, read as ~1.0 = corroborated, low = disagreement):

- **`gstToUpiRatio`** — catches a business that declares high GST turnover but whose
  bank account shows much smaller real inflows (turnover inflated on paper).
- **`epfoHeadcountToPayrollRatio`** — catches EPFO headcount that implies more
  payroll than the bank account actually pays out.

Either ratio dropping below `0.5` (`scoring/index.ts: consistencyFlag`) sets
`flags.consistency_alert` with a plain-language `detail` — not "can we repossess
something" but "do this business's own numbers agree with each other."

## Repayment capacity — grounded in real cashflow, not appraisal

`scoring/repayment.ts: sustainableEmi` sets the suggested lending term to **40% of
the projected worst-month net surplus** (from the 6-month cashflow forecast,
`scoring/forecast.ts`), floored at 0. The number comes from what the business's own
bank account says it can afford, not from a collateral resale valuation.

## Model validation

`scripts/validate-scores.ts` scores every DB-seeded MSME against its known synthetic
`outcome_label`, reporting AUC / Brier score / expected calibration error (ECE) /
accuracy@0.5 — split into the 20% slice `train.ts` held out for its own Platt-
calibration check ("held-out") and the full 2000-MSME set ("full set"):

| Metric | n | AUC | Brier | ECE | Accuracy@0.5 |
|---|---|---|---|---|---|
| Business Vitality (held-out) | 400 | 0.579 | 0.247 | 0.057 | 0.580 |
| Business Vitality (full set) | 2000 | 0.607 | 0.248 | 0.058 | 0.566 |
| Cashflow Health (held-out) | 400 | 0.652 | 0.225 | 0.041 | 0.600 |
| Cashflow Health (full set) | 2000 | 0.653 | 0.231 | 0.074 | 0.588 |
| Formalisation & Compliance (held-out) | 400 | 0.796 | 0.180 | 0.047 | 0.730 |
| Formalisation & Compliance (full set) | 2000 | 0.786 | 0.191 | 0.068 | 0.720 |
| Banking Behaviour (held-out) | 400 | 0.768 | 0.195 | 0.066 | 0.700 |
| Banking Behaviour (full set) | 2000 | 0.734 | 0.212 | 0.067 | 0.669 |
| Obligations & Leverage (held-out) | 400 | 0.567 | 0.245 | 0.031 | 0.570 |
| Obligations & Leverage (full set) | 2000 | 0.596 | 0.246 | 0.086 | 0.579 |
| **Overall score (held-out)** | 400 | **0.808** | 0.204 | 0.126 | 0.720 |
| **Overall score (full set)** | 2000 | **0.789** | 0.211 | 0.138 | 0.673 |

(AUC: 0.5 = random, 1.0 = perfect.) The blended overall score discriminates well
(AUC ≈ 0.79–0.81); Formalisation & Compliance and Banking Behaviour are individually
the strongest pillars, Business Vitality and Obligations & Leverage the weakest
despite carrying real weight in the blend.

## Novelty — what's actually distinctive

1. **Alternate-data scoring for thin-file MSMEs** — scores exactly the businesses a
   bureau-based system structurally can't, using data they already generate.
2. **Cross-source fraud detection built into the score itself**, not a bolted-on
   verification step — `gstToUpiRatio` / `epfoHeadcountToPayrollRatio` catch
   declared-vs-actual mismatches a single-source underwriter would never see.
3. **Exact, coefficient-based reason codes** instead of a SHAP/LIME approximation
   over a black-box model — every reason is traceable to the real deployed weights.
4. **Confidence tied to completeness with an actionable fix**, not a binary
   approve/reject on insufficient data.
5. **AI is quarantined to the explanation layer, never the decision.** The Groq-
   powered credit memo, borrower coach, and Q&A only ever narrate an
   already-computed, deterministic score — the system prompt explicitly forbids
   recomputing or second-guessing it (see `artifacts/api-server/src/lib/groq.ts`).
   In a category full of opaque "AI credit scoring" products, having a reproducible,
   audit-friendly, non-AI decision core with AI bolted on only for narration is a
   defensible compliance stance, not a footnote.
6. **Forward-looking repayment capacity, not just a risk label** — `sustainable_emi`
   and the 6-month forecast turn a score into an actual lending term.

## Known limitations (stated plainly)

- **Validated on synthetic data, not real outcomes.** The dataset's `outcome_label`
  is generated by the same latent process that generates the features
  (`scripts/generate-data.ts`) — the numbers above prove the pipeline correctly
  recovers a synthetic ground truth it was built to be recoverable from, not that it
  predicts real-world MSME defaults yet. Closing that gap needs real data (ingestion)
  and time (to observe real repayment behavior).
- **No true held-out set for the deployed weights.** `train.ts` refits each pillar's
  final coefficients on the *full* 2000-MSME set; the 80/20 split is only used to
  decide whether Platt recalibration is needed. The validation numbers above are
  therefore closer to in-sample than a genuine generalization test.
- **The overall blend is a fixed weighted sum, not learned or independently
  calibrated** — its own ECE (0.126–0.138) is measurably worse than the individual
  pillars' (0.03–0.09), since no calibration step is ever applied to the blend
  itself. Anywhere `overall_score / 100` is read as a literal probability (e.g. the
  portfolio's expected-default estimate) is looser than the pillar-level numbers
  feeding it.
