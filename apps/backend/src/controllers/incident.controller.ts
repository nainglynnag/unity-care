import { type Request, type Response, type NextFunction } from "express";
import * as incidentService from "../services/incident.service";
import {
  createIncidentSchema,
  closeIncidentByReporterSchema,
  updateIncidentStatusSchema,
  listMyIncidentQuerySchema,
  listIncidentQuerySchema,
  listAssignedIncidentsQuerySchema,
} from "../validators/incident.validator";
import { successResponse, paginatedResponse } from "../utils/response";
import { IncidentStatus } from "../../generated/prisma/client";

export interface IncidentParams extends Record<string, string> {
  id: string;
}

// Create Incident
// CIVILIAN only
export async function createIncident(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsedData = createIncidentSchema.parse(req.body);
    const reportedBy = req.user!.sub;

    const incident = await incidentService.createIncident(
      reportedBy,
      parsedData,
    );

    return successResponse(res, incident, 201);
  } catch (error) {
    next(error);
  }
}

// Get all incidents
// ADMIN / SUPERADMIN / VOLUNTEER
export async function listIncidents(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listIncidentQuerySchema.parse(req.query);
    const { incidents, pagination } = await incidentService.listIncidents(
      req.user!.sub,
      req.user!.role,
      query,
    );

    // Build query suffix that preserves all active filters in pagination links
    const base = `/incidents`;
    const filterParts: string[] = [];
    if (query.status) filterParts.push(`status=${query.status}`);
    if (query.categoryId) filterParts.push(`categoryId=${query.categoryId}`);
    if (query.lat !== undefined) {
      filterParts.push(`lat=${query.lat}`);
      filterParts.push(`lng=${query.lng}`);
      filterParts.push(`radiusKm=${query.radiusKm}`);
    }
    if (query.sortBy !== "createdAt")
      filterParts.push(`sortBy=${query.sortBy}`);
    const filterSuffix =
      filterParts.length > 0 ? `&${filterParts.join("&")}` : "";

    const links: Record<string, string> = {
      self: `${base}?page=${pagination.currentPage}&perPage=${pagination.perPage}${filterSuffix}`,
    };
    if (pagination.currentPage < pagination.totalPages) {
      links.next = `${base}?page=${pagination.currentPage + 1}&perPage=${pagination.perPage}${filterSuffix}`;
    }
    if (pagination.currentPage > 1) {
      links.prev = `${base}?page=${pagination.currentPage - 1}&perPage=${pagination.perPage}${filterSuffix}`;
    }

    return paginatedResponse(res, incidents, pagination, links);
  } catch (error) {
    next(error);
  }
}

// Get incident by reporter
// CIVILIAN only
export async function listMyIncidents(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listMyIncidentQuerySchema.parse(req.query);
    const reportedBy = req.user!.sub;

    const { incidents, pagination } = await incidentService.listMyIncidents(
      reportedBy,
      query,
    );

    const base = `/incidents/me`;
    const filterSuffix = query.status ? `&status=${query.status}` : "";
    const links: Record<string, string> = {
      self: `${base}?page=${pagination.currentPage}&perPage=${pagination.perPage}${filterSuffix}`,
    };
    if (pagination.currentPage < pagination.totalPages) {
      links.next = `${base}?page=${pagination.currentPage + 1}&perPage=${pagination.perPage}${filterSuffix}`;
    }
    if (pagination.currentPage > 1) {
      links.prev = `${base}?page=${pagination.currentPage - 1}&perPage=${pagination.perPage}${filterSuffix}`;
    }

    return paginatedResponse(res, incidents, pagination, links);
  } catch (error) {
    next(error);
  }
}

// List active incident categories (any authenticated user, for report form)
export async function listIncidentCategories(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const categories = await incidentService.listIncidentCategories();
    return successResponse(res, categories);
  } catch (error) {
    next(error);
  }
}

// Get incident by id
// Any authenticated user can view a specific incident.
export async function getIncident(
  req: Request<IncidentParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const incident = await incidentService.getIncidentById(
      req.params.id,
      req.user!.sub,
      req.user!.role,
    );
    return successResponse(res, incident);
  } catch (error) {
    next(error);
  }
}

// Update incident status
// CIVILIAN close their own incident
export async function closeIncidentByReporter(
  req: Request<IncidentParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const { note } = closeIncidentByReporterSchema.parse(req.body);
    const reportedBy = req.user!.sub;

    const incident = await incidentService.closeIncidentByReporter(
      req.params.id,
      reportedBy,
      note,
    );

    return successResponse(res, incident);
  } catch (error) {
    next(error);
  }
}

// COORDINATOR / DIRECTOR / SUPERADMIN only
export async function updateIncidentStatus(
  req: Request<IncidentParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const { status } = updateIncidentStatusSchema.parse(req.body);
    const incident = await incidentService.updateIncidentStatus(
      req.params.id,
      status as IncidentStatus,
      req.user!.sub,
      req.user!.role,
    );
    return successResponse(res, incident);
  } catch (error) {
    next(error);
  }
}

// GET /incidents/assigned
// VOLUNTEER only — returns incidents where the volunteer has a verification
// assignment (active or historical). Includes their assignment status.
export async function listAssignedIncidents(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listAssignedIncidentsQuerySchema.parse(req.query);
    const result = await incidentService.listAssignedIncidents(
      req.user!.sub,
      query,
    );

    const base = `/incidents/assigned`;
    const filterSuffix = query.status ? `&status=${query.status}` : "";
    const links: Record<string, string> = {
      self: `${base}?page=${result.pagination.currentPage}&perPage=${result.pagination.perPage}${filterSuffix}`,
    };
    if (result.pagination.currentPage < result.pagination.totalPages) {
      links.next = `${base}?page=${result.pagination.currentPage + 1}&perPage=${result.pagination.perPage}${filterSuffix}`;
    }
    if (result.pagination.currentPage > 1) {
      links.prev = `${base}?page=${result.pagination.currentPage - 1}&perPage=${result.pagination.perPage}${filterSuffix}`;
    }

    return paginatedResponse(res, result.assignments, result.pagination, links);
  } catch (error) {
    next(error);
  }
}
