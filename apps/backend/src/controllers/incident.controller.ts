import { type Request, type Response, type NextFunction } from "express";
import * as incidentService from "../services/incident.service";
import {
  createIncidentSchema,
  closeIncidentByReporterSchema,
  updateIncidentStatusSchema,
  listIncidentQuerySchema,
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
// ADMIN / VOLUNTEER
export async function listIncidents(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listIncidentQuerySchema.parse(req.query);
    const { incidents, pagination } =
      await incidentService.listIncidents(query);

    const base = `/incidents`;
    const links: Record<string, string> = {
      self: `${base}?page=${pagination.currentPage}&perPage=${pagination.perPage}`,
    };
    if (pagination.currentPage < pagination.totalPages) {
      links.next = `${base}?page=${pagination.currentPage + 1}&perPage=${pagination.perPage}`;
    }
    if (pagination.currentPage > 1) {
      links.prev = `${base}?page=${pagination.currentPage - 1}&perPage=${pagination.perPage}`;
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
    const query = listIncidentQuerySchema.parse(req.query);
    const reportedBy = req.user!.sub;

    const { incidents, pagination } = await incidentService.listMyIncidents(
      reportedBy,
      query,
    );

    const base = `/incidents/me`;
    const links: Record<string, string> = {
      self: `${base}?page=${pagination.currentPage}&perPage=${pagination.perPage}`,
    };
    if (pagination.currentPage < pagination.totalPages) {
      links.next = `${base}?page=${pagination.currentPage + 1}&perPage=${pagination.perPage}`;
    }
    if (pagination.currentPage > 1) {
      links.prev = `${base}?page=${pagination.currentPage - 1}&perPage=${pagination.perPage}`;
    }

    return paginatedResponse(res, incidents, pagination, links);
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

// ADMIN only
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
    );
    return successResponse(res, incident);
  } catch (error) {
    next(error);
  }
}
