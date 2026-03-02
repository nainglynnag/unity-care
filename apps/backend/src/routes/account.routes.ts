import { Router } from "express";
import * as accountController from "../controllers/account.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { changePasswordLimiter } from "../middlewares/rateLimit";

const router = Router();
router.use(authenticate);

// PATCH /account/profile — update name / profileImageUrl
router.patch("/profile", accountController.updateProfile);

// PATCH /account/password — 10 per user per 15 minutes
router.patch(
  "/password",
  changePasswordLimiter,
  accountController.updatePassword,
);

// DELETE /account — soft delete own account
router.delete("/", accountController.softDeleteAccount);

export default router;
