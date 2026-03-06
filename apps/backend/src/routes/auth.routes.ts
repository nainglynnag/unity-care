import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as accountController from "../controllers/account.controller";
import { authenticate } from "../middlewares/auth.middleware";
import {
  registerLimiter,
  loginLimiter,
  refreshLimiter,
  signOutLimiter,
  authMeLimiter,
} from "../middlewares/rateLimit";

const router = Router();

// Public — limiters run before handler (no auth required)
router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/google", loginLimiter, authController.googleAuth);
router.post("/refresh", refreshLimiter, authController.refresh);

// Protected — authenticate first so req.user is populated for user-keyed limiters.
// authMeLimiter: per-user 60/15min so GET /me doesn't rely only on global 200/IP (fixes 429 in volunteer layout).

router.get("/me", authenticate, authController.me);


router.post(
  "/signout",
  authenticate,
  signOutLimiter,
  accountController.signOut,
);
router.post(
  "/signout-all",
  authenticate,
  signOutLimiter,
  accountController.signOutAll,
);

export default router;
