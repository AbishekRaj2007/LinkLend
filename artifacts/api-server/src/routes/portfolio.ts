import { Router, type IRouter } from "express";
import { GetPortfolioResponse } from "@workspace/api-zod";
import { buildPortfolio } from "../data/store";

const router: IRouter = Router();

router.get("/portfolio", (_req, res) => {
  res.json(GetPortfolioResponse.parse(buildPortfolio()));
});

export default router;
