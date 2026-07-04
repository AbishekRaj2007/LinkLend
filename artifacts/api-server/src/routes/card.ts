import { Router, type IRouter } from "express";
import { GetCardResponse } from "@workspace/api-zod";
import { getCachedCard } from "../data/store";

const router: IRouter = Router();

router.get("/card/:msme_id", (req, res) => {
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
