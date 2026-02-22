import { Router } from "express";
import * as volunteerApplicationController from "../controllers/volunteerApplication.controller";
import type { ApplicationParams } from "../controllers/volunteerApplication.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

// CIVILIAN
router.post(
  "/",
  requireRoles("CIVILIAN"),
  volunteerApplicationController.submitApplication,
);

router.get(
  "/me",
  requireRoles("CIVILIAN"),
  volunteerApplicationController.getMyApplications,
);

// CIVILIAN own / ADMIN any
router.get<ApplicationParams>(
  "/:id",
  volunteerApplicationController.getApplication,
);

// CIVILIAN only
router.patch<ApplicationParams>(
  "/:id/withdraw",
  requireRoles("CIVILIAN"),
  volunteerApplicationController.withdrawApplication,
);

router.patch<ApplicationParams>(
  "/:id",
  requireRoles("CIVILIAN"),
  volunteerApplicationController.updateApplication,
);

export default router;
