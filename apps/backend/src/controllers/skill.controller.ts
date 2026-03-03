import { type Request, type Response, type NextFunction } from "express";
import * as skillService from "../services/skill.service";
import {
  createSkillSchema,
  updateSkillSchema,
  listSkillsQuerySchema,
} from "../validators/skill.validator";
import { successResponse, paginatedResponse } from "../utils/response";

interface SkillParams extends Record<string, string> {
  id: string;
}

// Build query string from parsed params, replacing page number
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

export async function listSkills(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listSkillsQuerySchema.parse(req.query);
    const result = await skillService.listSkills(req.user!.role, query);
    const { currentPage, totalPages, perPage } = result.pagination;
    return paginatedResponse(res, result.skills, result.pagination, {
      self: `/skills?${buildQs(query, currentPage, perPage)}`,
      ...(currentPage < totalPages && {
        next: `/skills?${buildQs(query, currentPage + 1, perPage)}`,
      }),
      ...(currentPage > 1 && {
        prev: `/skills?${buildQs(query, currentPage - 1, perPage)}`,
      }),
    });
  } catch (e) {
    next(e);
  }
}

export async function getSkill(
  req: Request<SkillParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(res, await skillService.getSkill(req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function createSkill(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = createSkillSchema.parse(req.body);
    return successResponse(
      res,
      await skillService.createSkill(
        { id: req.user!.sub, role: req.user!.role },
        data,
      ),
      201,
    );
  } catch (e) {
    next(e);
  }
}

export async function updateSkill(
  req: Request<SkillParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateSkillSchema.parse(req.body);
    return successResponse(
      res,
      await skillService.updateSkill(
        { id: req.user!.sub, role: req.user!.role },
        req.params.id,
        data,
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function deleteSkill(
  req: Request<SkillParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await skillService.deleteSkill(
        { id: req.user!.sub, role: req.user!.role },
        req.params.id,
      ),
    );
  } catch (e) {
    next(e);
  }
}
