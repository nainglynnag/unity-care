import { type Request, type Response, type NextFunction } from "express";
import {
  periodSchema,
  adminDashboardSchema,
} from "../validators/dashboard.validator";
import * as volunteerSvc from "../services/dashboard/volunteer.service";
import * as agencySvc from "../services/dashboard/agency.service";
import * as adminSvc from "../services/dashboard/admin.service";
import { successResponse } from "../utils/response";
import { ForbiddenError } from "../utils/errors";

// Volunteer

export async function volunteerSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period } = periodSchema.parse(req.query);
    return successResponse(
      res,
      await volunteerSvc.getSummary(req.user!.sub, period),
    );
  } catch (e) {
    next(e);
  }
}

export async function volunteerMissions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period } = periodSchema.parse(req.query);
    return successResponse(
      res,
      await volunteerSvc.getMissionBreakdown(req.user!.sub, period),
    );
  } catch (e) {
    next(e);
  }
}

export async function volunteerVerifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period } = periodSchema.parse(req.query);
    return successResponse(
      res,
      await volunteerSvc.getVerificationStats(req.user!.sub, period),
    );
  } catch (e) {
    next(e);
  }
}

// Agency

async function getAgencyId(req: Request): Promise<string> {
  return agencySvc.resolveAgencyId(
    req.user!.sub,
    req.user!.role,
    req.query.agencyId as string | undefined,
  );
}

export async function agencyLive(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const agencyId = await getAgencyId(req);
    return successResponse(res, await agencySvc.getLiveSnapshot(agencyId));
  } catch (e) {
    next(e);
  }
}

export async function agencyIncidents(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period } = periodSchema.parse(req.query);
    const agencyId = await getAgencyId(req);
    return successResponse(
      res,
      await agencySvc.getIncidentMetrics(agencyId, period),
    );
  } catch (e) {
    next(e);
  }
}

export async function agencyMissions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period } = periodSchema.parse(req.query);
    const agencyId = await getAgencyId(req);
    return successResponse(
      res,
      await agencySvc.getMissionMetrics(agencyId, period),
    );
  } catch (e) {
    next(e);
  }
}

export async function agencyVolunteers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period } = periodSchema.parse(req.query);
    const agencyId = await getAgencyId(req);
    return successResponse(
      res,
      await agencySvc.getVolunteerMetrics(agencyId, period),
    );
  } catch (e) {
    next(e);
  }
}

export async function agencyCategories(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period } = periodSchema.parse(req.query);
    const agencyId = await getAgencyId(req);
    return successResponse(
      res,
      await agencySvc.getCategoryBreakdown(agencyId, period),
    );
  } catch (e) {
    next(e);
  }
}

export async function agencyApplications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period } = periodSchema.parse(req.query);
    const membership = await agencySvc.resolveAgencyMembership(req.user!.sub);
    // Applications endpoint is DIRECTOR only (or SUPERADMIN with agencyId)
    if (req.user!.role !== "SUPERADMIN" && membership.role !== "DIRECTOR") {
      return next(new ForbiddenError());
    }
    const agencyId =
      req.user!.role === "SUPERADMIN"
        ? (req.query.agencyId as string)
        : membership.agencyId;
    return successResponse(
      res,
      await agencySvc.getApplicationMetrics(agencyId, period),
    );
  } catch (e) {
    next(e);
  }
}

// Admin / SUPERADMIN

export async function adminOverview(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period, agencyId } = adminDashboardSchema.parse(req.query);
    return successResponse(
      res,
      await adminSvc.getPlatformOverview(period, agencyId),
    );
  } catch (e) {
    next(e);
  }
}

export async function adminRetention(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period, agencyId } = adminDashboardSchema.parse(req.query);
    return successResponse(
      res,
      await adminSvc.getRetentionMetrics(period, agencyId),
    );
  } catch (e) {
    next(e);
  }
}

export async function adminHealth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period, agencyId } = adminDashboardSchema.parse(req.query);
    return successResponse(
      res,
      await adminSvc.getPlatformHealth(period, agencyId),
    );
  } catch (e) {
    next(e);
  }
}

export async function adminAgencies(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period, agencyId } = adminDashboardSchema.parse(req.query);
    return successResponse(
      res,
      await adminSvc.getAgencyComparison(period, agencyId),
    );
  } catch (e) {
    next(e);
  }
}

export async function adminApplications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { period, agencyId } = adminDashboardSchema.parse(req.query);
    return successResponse(
      res,
      await adminSvc.getApplicationPipeline(period, agencyId),
    );
  } catch (e) {
    next(e);
  }
}
