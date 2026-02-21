import { Router } from "express";
import * as emergencyProfileController from "../controllers/emergencyProfile.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import type { EmergencyProfileParams } from "../controllers/emergencyProfile.controller";

const router = Router();
router.use(authenticate);

// CIVILIAN routes
// Create a new emergency profile with optional contacts
router.post(
  "/me",
  requireRoles("CIVILIAN"),
  emergencyProfileController.createMyProfile,
);

// Update an existing emergency profile (profile fields only)
router.patch(
  "/me",
  requireRoles("CIVILIAN"),
  emergencyProfileController.updateMyProfile,
);

// Get the civilian's own emergency profile & contacts
router.get(
  "/me",
  requireRoles("CIVILIAN"),
  emergencyProfileController.getMyProfile,
);

// ADMIN / VOLUNTEER routes
// Get a specific emergency profile by ID
router.get<EmergencyProfileParams>(
  "/:id",
  requireRoles("ADMIN", "VOLUNTEER"),
  emergencyProfileController.getProfileById,
);

// ADMIN routes
// List all emergency profiles
router.get("/", requireRoles("ADMIN"), emergencyProfileController.listProfiles);

export default router;
