import { type Request, type Response, type NextFunction } from "express";
import * as notifService from "../services/notification.service";
import {
  listNotificationsQuerySchema,
  deleteAllNotificationsQuerySchema,
} from "../validators/notification.validator";
import { successResponse, paginatedResponse } from "../utils/response";

interface NotifParams extends Record<string, string> {
  id: string;
}

// Build query string preserving filter params in pagination links.
function buildQs(
  base: Record<string, unknown>,
  page: number,
  perPage: number,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && v !== null && v !== false) params.set(k, String(v));
  }
  params.set("page", String(page));
  params.set("perPage", String(perPage));
  return params.toString();
}

// GET /notifications
export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listNotificationsQuerySchema.parse(req.query);
    const result = await notifService.listNotifications(req.user!.sub, query);
    const { currentPage, totalPages, perPage } = result.pagination;

    const filters = {
      type: query.type,
      unreadOnly: query.unreadOnly || undefined,
    };

    return paginatedResponse(
      res,
      result.notifications,
      result.pagination,
      {
        self: `/notifications?${buildQs(filters, currentPage, perPage)}`,
        ...(currentPage < totalPages && {
          next: `/notifications?${buildQs(filters, currentPage + 1, perPage)}`,
        }),
        ...(currentPage > 1 && {
          prev: `/notifications?${buildQs(filters, currentPage - 1, perPage)}`,
        }),
      },
      { unreadCount: result.unreadCount },
    );
  } catch (e) {
    next(e);
  }
}

// GET /notifications/unread-count
export async function getUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await notifService.getUnreadCount(req.user!.sub),
    );
  } catch (e) {
    next(e);
  }
}

// PATCH /notifications/:id/read
export async function markAsRead(
  req: Request<NotifParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await notifService.markAsRead(req.user!.sub, req.params.id),
    );
  } catch (e) {
    next(e);
  }
}

// PATCH /notifications/read-all
export async function markAllAsRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await notifService.markAllAsRead(req.user!.sub),
    );
  } catch (e) {
    next(e);
  }
}

// DELETE /notifications/:id
export async function deleteNotification(
  req: Request<NotifParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await notifService.deleteNotification(req.user!.sub, req.params.id),
    );
  } catch (e) {
    next(e);
  }
}

// DELETE /notifications
export async function deleteAllNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { keepUnread } = deleteAllNotificationsQuerySchema.parse(req.query);
    return successResponse(
      res,
      await notifService.deleteAllNotifications(
        req.user!.sub,
        keepUnread ?? true,
      ),
    );
  } catch (e) {
    next(e);
  }
}
