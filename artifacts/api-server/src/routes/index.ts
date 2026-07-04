import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assessRouter from "./assess";
import cardRouter from "./card";
import portfolioRouter from "./portfolio";
import authRouter from "./auth";
import meRouter from "./me";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assessRouter);
router.use(cardRouter);
router.use(portfolioRouter);
router.use(authRouter);
router.use(meRouter);

export default router;
