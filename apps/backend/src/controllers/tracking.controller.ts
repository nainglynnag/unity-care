import { type Request, type Response, type NextFunction } from "express";
import * as trackingService from "../services/tracking.service";
import {
  pushTrackingSchema,
  getTrackingQuerySchema,
} from "../validators/tracking.validator";
import { successResponse } from "../utils/response";

interface MissionParams extends Record<string, string> {
  id: string;
}

// POST /missions/:id/tracking
export async function pushTracking(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = pushTrackingSchema.parse(req.body);
    const result = await trackingService.pushTracking(
      req.user!.sub,
      req.params.id,
      data,
    );
    return successResponse(res, result, 201);
  } catch (e) {
    next(e);
  }
}

// GET /missions/:id/tracking
export async function getTrackingHistory(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = getTrackingQuerySchema.parse(req.query);
    const result = await trackingService.getTrackingHistory(
      req.user!.sub,
      req.user!.role,
      req.params.id,
      query,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// GET /missions/:id/tracking/latest
export async function getLatestTracking(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await trackingService.getLatestTracking(
      req.user!.sub,
      req.user!.role,
      req.params.id,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}
