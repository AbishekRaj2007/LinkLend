import { Router, type IRouter } from "express";
import { AssessBody, AssessResponse } from "@workspace/api-zod";
import { computeCard, cacheCard, saveScoreHistory } from "../data/store";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/assess", requireAuth, requireRole("lender"), async (req, res) => {
  const parsed = AssessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body: msme_id is required." });
    return;
  }

  const card = await computeCard(parsed.data.msme_id);
  if (!card) {
    res.status(404).json({ message: `Unknown MSME: ${parsed.data.msme_id}` });
    return;
  }

  cacheCard(card);
  await saveScoreHistory(card, req.user?.id ?? null);
  res.json(AssessResponse.parse(card));
});

export default router;
