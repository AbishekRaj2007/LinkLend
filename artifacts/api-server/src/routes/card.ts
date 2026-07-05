import { Router, type IRouter } from "express";
import {
  GetCardResponse,
  GetCardHistoryResponse,
  GenerateCardMemoResponse,
} from "@workspace/api-zod";
import {
  getCachedCard,
  getScoreHistory,
  getLatestScore,
  setScoreMemo,
} from "../data/store";
import { generateCreditMemo } from "../lib/groq";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get<{ msme_id: string }>(
  "/card/:msme_id/history",
  requireAuth,
  requireRole("lender"),
  async (req, res) => {
    const history = await getScoreHistory(req.params.msme_id);
    res.json(GetCardHistoryResponse.parse(history));
  },
);

router.post<{ msme_id: string }>(
  "/card/:msme_id/memo",
  requireAuth,
  requireRole("lender"),
  async (req, res) => {
    const latest = await getLatestScore(req.params.msme_id);
    if (!latest) {
      res.status(404).json({
        message: `No assessment for MSME: ${req.params.msme_id}. Assess it first.`,
      });
      return;
    }

    // Generate once, then serve the cached memo on repeat calls.
    let memo = latest.memo;
    if (!memo) {
      memo = await generateCreditMemo(latest.card);
      await setScoreMemo(latest.id, memo);
    }

    res.json(GenerateCardMemoResponse.parse({ memo }));
  },
);

router.get<{ msme_id: string }>("/card/:msme_id", requireAuth, requireRole("lender"), (req, res) => {
  const card = getCachedCard(req.params.msme_id);
  if (!card) {
    res
      .status(404)
      .json({ message: `No cached scorecard for MSME: ${req.params.msme_id}` });
    return;
  }

  res.json(GetCardResponse.parse(card));
});

export default router;
