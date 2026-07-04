import { Router, type IRouter } from "express";
import { AssessBody, AssessResponse } from "@workspace/api-zod";
import { computeCard, cacheCard } from "../data/store";

const router: IRouter = Router();

router.post("/assess", (req, res) => {
  const parsed = AssessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body: msme_id is required." });
    return;
  }

  const card = computeCard(parsed.data.msme_id);
  if (!card) {
    res.status(404).json({ message: `Unknown MSME: ${parsed.data.msme_id}` });
    return;
  }

  cacheCard(card);
  res.json(AssessResponse.parse(card));
});

export default router;
