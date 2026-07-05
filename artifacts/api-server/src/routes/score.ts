import { Router, type IRouter } from "express";
import { listMsmeIds, loadBundle } from "../data/store";
import { scoreMsme } from "../scoring/score";
import { narrateScorecard } from "../lib/groq";

const router: IRouter = Router();

/** All MSME ids available to score. */
router.get("/msmes", async (_req, res) => {
  const ids = await listMsmeIds();
  res.json({ msmeIds: ids });
});

/** Deterministic scorecard for one MSME. */
router.get("/msmes/:id/scorecard", async (req, res) => {
  const bundle = await loadBundle(req.params.id);
  if (!bundle) {
    res.status(404).json({ error: `MSME ${req.params.id} not found` });
    return;
  }
  res.json(scoreMsme(bundle));
});

/** Scorecard plus an AI-narrated credit memo (narration only, never recompute). */
router.get("/msmes/:id/memo", async (req, res) => {
  const bundle = await loadBundle(req.params.id);
  if (!bundle) {
    res.status(404).json({ error: `MSME ${req.params.id} not found` });
    return;
  }
  const scorecard = scoreMsme(bundle);
  const memo = await narrateScorecard(scorecard);
  res.json({ scorecard, memo });
});

export default router;
