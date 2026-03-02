import { Router } from "express";
import * as volunteerProfileController from "../controllers/volunteerProfile.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.use(requireRoles("VOLUNTEER"));

// NOTE: /availability before / route to prevent route shadowing
router.get("/me", volunteerProfileController.getProfile);
router.patch("/me/availability", volunteerProfileController.updateAvailability);
router.patch("/me", volunteerProfileController.updateProfile);

export default router;
