import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import invoicesRouter from "./invoices";
import invoiceItemTemplatesRouter from "./invoice-item-templates";
import receiptsRouter from "./receipts";
import trashRouter from "./trash";
import usersManagementRouter from "./users-management";
import accountingRouter from "./accounting";
import companySettingsRouter from "./company-settings";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

// All routes below require authentication
router.use(requireAuth);

router.use(clientsRouter);
router.use(invoicesRouter);
router.use(invoiceItemTemplatesRouter);
router.use(receiptsRouter);
router.use(trashRouter);
router.use(usersManagementRouter);
router.use(accountingRouter);
router.use(companySettingsRouter);

export default router;
