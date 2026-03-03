import { type Request, type Response, type NextFunction } from "express";
import * as agencyService from "../services/agency.service";
import {
  createAgencySchema,
  updateAgencySchema,
  listAgenciesQuerySchema,
  listAvailableVolunteersQuerySchema,
} from "../validators/agency.validator";
import { successResponse, paginatedResponse } from "../utils/response";

interface AgencyParams extends Record<string, string> {
  id: string;
}

function buildQs(
  query: Record<string, unknown>,
  page: number,
  perPage: number,
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("perPage", String(perPage));
  for (const [key, val] of Object.entries(query)) {
    if (key === "page" || key === "perPage" || val === undefined) continue;
    params.set(key, String(val));
  }
  return params.toString();
}

export async function listAgencies(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listAgenciesQuerySchema.parse(req.query);
    const result = await agencyService.listAgencies(req.user!.role, query);
    const { currentPage, totalPages, perPage } = result.pagination;
    return paginatedResponse(res, result.agencies, result.pagination, {
      self: `/agencies?${buildQs(query, currentPage, perPage)}`,
      ...(currentPage < totalPages && {
        next: `/agencies?${buildQs(query, currentPage + 1, perPage)}`,
      }),
      ...(currentPage > 1 && {
        prev: `/agencies?${buildQs(query, currentPage - 1, perPage)}`,
      }),
    });
  } catch (e) {
    next(e);
  }
}

export async function getAgency(
  req: Request<AgencyParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await agencyService.getAgency(req.params.id, req.user!.role),
    );
  } catch (e) {
    next(e);
  }
}

export async function createAgency(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = createAgencySchema.parse(req.body);
    return successResponse(
      res,
      await agencyService.createAgency(
        { id: req.user!.sub, role: req.user!.role },
        data,
      ),
      201,
    );
  } catch (e) {
    next(e);
  }
}

export async function updateAgency(
  req: Request<AgencyParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateAgencySchema.parse(req.body);
    return successResponse(
      res,
      await agencyService.updateAgency(
        { id: req.user!.sub, role: req.user!.role },
        req.params.id,
        data,
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function deleteAgency(
  req: Request<AgencyParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await agencyService.deleteAgency(
        { id: req.user!.sub, role: req.user!.role },
        req.params.id,
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function listAvailableVolunteers(
  req: Request<AgencyParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listAvailableVolunteersQuerySchema.parse(req.query);
    const result = await agencyService.listAvailableVolunteers(
      { id: req.user!.sub, role: req.user!.role },
      req.params.id,
      query,
    );
    const { currentPage, totalPages, perPage } = result.pagination;
    const base = `/agencies/${req.params.id}/volunteers`;
    return paginatedResponse(res, result.volunteers, result.pagination, {
      self: `${base}?${buildQs(query, currentPage, perPage)}`,
      ...(currentPage < totalPages && {
        next: `${base}?${buildQs(query, currentPage + 1, perPage)}`,
      }),
      ...(currentPage > 1 && {
        prev: `${base}?${buildQs(query, currentPage - 1, perPage)}`,
      }),
    });
  } catch (e) {
    next(e);
  }
}
