import { Router } from "express";
import * as volunteerProfileController from "../controllers/volunteerProfile.controller";
import { authenticate, requireVolunteerProfile } from "../middlewares/auth.middleware";
import { volunteerProfileMeLimiter } from "../middlewares/rateLimit";

const router = Router();

router.use(authenticate);
router.use(requireVolunteerProfile);

// NOTE: /availability before / route to prevent route shadowing
// volunteerProfileMeLimiter: per-user 60/15min so GET /me doesn't rely only on global 200/IP (fixes 429).
router.get("/me", volunteerProfileMeLimiter, volunteerProfileController.getProfile);
router.patch("/me/availability", volunteerProfileController.updateAvailability);
router.patch("/me", volunteerProfileController.updateProfile);

export default router;
