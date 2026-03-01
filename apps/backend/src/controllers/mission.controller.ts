import { type Request, type Response, type NextFunction } from "express";
import * as missionService from "../services/mission.service";
import {
  createMissionSchema,
  rejectMissionSchema,
  agencyDecisionSchema,
  startTravelSchema,
  arriveOnSiteSchema,
  startWorkSchema,
  submitCompletionReportSchema,
  confirmCompletionSchema,
  cancelMissionSchema,
  reportFailureSchema,
  resolveIncidentSchema,
  listMissionsQuerySchema,
} from "../validators/mission.validator";
import { successResponse, paginatedResponse } from "../utils/response";

export interface MissionParams extends Record<string, string> {
  id: string;
}

function buildPaginationLinks(
  base: string,
  pagination: { currentPage: number; totalPages: number; perPage: number },
  extraQuery: Record<string, unknown> = {},
) {
  const qs = (page: number) =>
    new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(extraQuery)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ),
      page: String(page),
      perPage: String(pagination.perPage),
    }).toString();

  const links: Record<string, string> = {
    self: `${base}?${qs(pagination.currentPage)}`,
  };
  if (pagination.currentPage < pagination.totalPages)
    links.next = `${base}?${qs(pagination.currentPage + 1)}`;
  if (pagination.currentPage > 1)
    links.prev = `${base}?${qs(pagination.currentPage - 1)}`;
  return links;
}

// POST /missions
export async function createMission(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = createMissionSchema.parse(req.body);
    const result = await missionService.createMission(
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result, 201);
  } catch (e) {
    next(e);
  }
}

// GET /missions
export async function listMissions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listMissionsQuerySchema.parse(req.query);
    const result = await missionService.listMissions(
      req.user!.sub,
      req.user!.role,
      query,
    );
    return paginatedResponse(
      res,
      result.missions,
      result.pagination,
      buildPaginationLinks("/missions", result.pagination, query),
    );
  } catch (e) {
    next(e);
  }
}

// GET /missions/assigned
export async function listMyMissions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listMissionsQuerySchema.parse(req.query);
    const result = await missionService.listMyMissions(req.user!.sub, query);
    return paginatedResponse(
      res,
      result.missions,
      result.pagination,
      buildPaginationLinks("/missions/assigned", result.pagination, query),
    );
  } catch (e) {
    next(e);
  }
}

// GET /missions/:id
export async function getMission(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await missionService.getMission(
      req.params.id,
      req.user!.sub,
      req.user!.role,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/accept
export async function acceptMission(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await missionService.acceptMission(
      req.params.id,
      req.user!.sub,
      req.user!.role,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/reject
export async function rejectMission(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = rejectMissionSchema.parse(req.body);
    const result = await missionService.rejectMission(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/agency-decision
export async function agencyDecision(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = agencyDecisionSchema.parse(req.body);
    const result = await missionService.agencyDecision(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/start-travel
export async function startTravel(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = startTravelSchema.parse(req.body);
    const result = await missionService.startTravel(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/arrive
export async function arriveOnSite(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = arriveOnSiteSchema.parse(req.body);
    const result = await missionService.arriveOnSite(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/start-work
export async function startWork(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = startWorkSchema.parse(req.body);
    const result = await missionService.startWork(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// POST /missions/:id/completion-report
export async function submitCompletionReport(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = submitCompletionReportSchema.parse(req.body);
    const result = await missionService.submitCompletionReport(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/confirm-completion
export async function confirmCompletion(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = confirmCompletionSchema.parse(req.body);
    const result = await missionService.confirmCompletion(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/cancel
export async function cancelMission(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = cancelMissionSchema.parse(req.body);
    const result = await missionService.cancelMission(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /missions/:id/report-failure
export async function reportFailure(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = reportFailureSchema.parse(req.body);
    const result = await missionService.reportFailure(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}

// PATCH /incidents/:id/resolve
export async function resolveIncident(
  req: Request<MissionParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = resolveIncidentSchema.parse(req.body);
    const result = await missionService.resolveIncident(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (e) {
    next(e);
  }
}
