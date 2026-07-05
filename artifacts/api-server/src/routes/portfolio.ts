import { Router, type IRouter } from "express";
import { GetPortfolioResponse } from "@workspace/api-zod";
import { buildPortfolio } from "../data/store";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/portfolio", requireAuth, requireRole("lender"), async (_req, res) => {
  res.json(GetPortfolioResponse.parse(await buildPortfolio()));
});

export default router;
