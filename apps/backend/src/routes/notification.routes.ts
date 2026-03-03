import { Router } from "express";
import * as ctrl from "../controllers/notification.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { notificationPollLimiter } from "../middlewares/rateLimit";

const router = Router();
router.use(authenticate);

// All notification routes require authentication.
// No requireRoles — every role has a personal inbox.
// Ownership enforced in service via userId = req.user.sub.

// CRITICAL route ordering:
// /unread-count must come before /:id
// /read-all must come before /:id/read
// DELETE / must come before DELETE /:id

// GET  /notifications/unread-count — badge count only
router.get("/unread-count", notificationPollLimiter, ctrl.getUnreadCount);

// PATCH /notifications/read-all — bulk mark all as read
router.patch("/read-all", ctrl.markAllAsRead);

// GET  /notifications — list with filters + pagination
router.get("/", notificationPollLimiter, ctrl.listNotifications);

// PATCH /notifications/:id/read — mark one as read
router.patch("/:id/read", ctrl.markAsRead);

// DELETE /notifications — clear inbox (defaults to read-only; ?keepUnread=false to wipe all)
router.delete("/", ctrl.deleteAllNotifications);

// DELETE /notifications/:id — delete one
router.delete("/:id", ctrl.deleteNotification);

export default router;
