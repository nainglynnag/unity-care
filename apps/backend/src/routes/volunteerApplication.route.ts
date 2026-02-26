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

// ADMIN / COORDINATOR / DIRECTOR — list all applications
router.get(
  "/",
  requireRoles("SUPERADMIN", "ADMIN", "VOLUNTEER"),
  volunteerApplicationController.listApplications,
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

// SUPERADMIN / COORDINATOR / DIRECTOR — agency-level auth resolved in service
router.patch<ApplicationParams>(
  "/:id/review",
  requireRoles("SUPERADMIN", "VOLUNTEER"),
  volunteerApplicationController.reviewApplication,
);

export default router;
