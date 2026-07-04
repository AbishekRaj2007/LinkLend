import { Router, type IRouter } from "express";
import { GetMyScorecardResponse } from "@workspace/api-zod";
import { computeCard } from "../data/store";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get(
  "/me/scorecard",
  requireAuth,
  requireRole("borrower"),
  (req, res) => {
    const msmeId = req.user!.msmeId;
    if (!msmeId) {
      res.status(404).json({ message: "No MSME linked to this account" });
      return;
    }

    const card = computeCard(msmeId);
    if (!card) {
      res.status(404).json({ message: `Unknown MSME: ${msmeId}` });
      return;
    }

    res.json(GetMyScorecardResponse.parse(card));
  },
);

export default router;
