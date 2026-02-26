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

// SUPERADMIN / ADMIN / COORDINATOR / DIRECTOR — list all applications
router.get(
  "/",
  requireRoles("SUPERADMIN", "ADMIN", "VOLUNTEER"),
  volunteerApplicationController.listApplications,
);

// Any authenticated user — scoped in service
router.get<ApplicationParams>(
  "/:id",
  volunteerApplicationController.getApplication,
);

// SUPERADMIN / COORDINATOR / DIRECTOR — claim an application for review
router.patch<ApplicationParams>(
  "/:id/start-review",
  requireRoles("SUPERADMIN", "VOLUNTEER"),
  volunteerApplicationController.startReview,
);

// SUPERADMIN / COORDINATOR / DIRECTOR — approve or reject
router.patch<ApplicationParams>(
  "/:id/review",
  requireRoles("SUPERADMIN", "VOLUNTEER"),
  volunteerApplicationController.reviewApplication,
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
