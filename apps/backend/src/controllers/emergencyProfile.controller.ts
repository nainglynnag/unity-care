import { type Request, type Response, type NextFunction } from "express";
import * as emergencyProfileService from "../services/emergencyProfile.service";
import {
  createEmergencyProfileSchema,
  updateEmergencyProfileSchema,
  listEmergencyProfileQuerySchema,
} from "../validators/emergencyProfile.validator";
import { successResponse, paginatedResponse } from "../utils/response";

export interface EmergencyProfileParams extends Record<string, string> {
  id: string;
}

// Create My Emergency Profile
// CIVILIAN only
export async function createMyProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsedData = createEmergencyProfileSchema.parse(req.body);
    const userId = req.user!.sub;

    const profile = await emergencyProfileService.createMyProfile(
      userId,
      parsedData,
    );

    return successResponse(res, profile, 201);
  } catch (error) {
    next(error);
  }
}

// Update My Emergency Profile
// CIVILIAN only — partially updates profile fields, does not replace contacts.
export async function updateMyProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsedData = updateEmergencyProfileSchema.parse(req.body);
    const userId = req.user!.sub;

    const profile = await emergencyProfileService.updateMyProfile(
      userId,
      parsedData,
    );

    return successResponse(res, profile);
  } catch (error) {
    next(error);
  }
}

// Get My Emergency Profile
// CIVILIAN only
export async function getMyProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user!.sub;
    const profile = await emergencyProfileService.getMyProfile(userId);

    return successResponse(res, profile);
  } catch (error) {
    next(error);
  }
}

// Get Emergency Profile by ID
// ADMIN / VOLUNTEER
export async function getProfileById(
  req: Request<EmergencyProfileParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const profile = await emergencyProfileService.getProfileById(req.params.id);

    return successResponse(res, profile);
  } catch (error) {
    next(error);
  }
}

// List All Emergency Profiles
// ADMIN only
export async function listProfiles(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listEmergencyProfileQuerySchema.parse(req.query);
    const { profiles, pagination } =
      await emergencyProfileService.listProfiles(query);

    const base = `/emergency-profiles`;
    const links: Record<string, string> = {
      self: `${base}?page=${pagination.currentPage}&perPage=${pagination.perPage}`,
    };
    if (pagination.currentPage < pagination.totalPages) {
      links.next = `${base}?page=${pagination.currentPage + 1}&perPage=${pagination.perPage}`;
    }
    if (pagination.currentPage > 1) {
      links.prev = `${base}?page=${pagination.currentPage - 1}&perPage=${pagination.perPage}`;
    }

    return paginatedResponse(res, profiles, pagination, links);
  } catch (error) {
    next(error);
  }
}
