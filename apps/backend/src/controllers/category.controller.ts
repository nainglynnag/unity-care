import { type Request, type Response, type NextFunction } from "express";
import * as categoryService from "../services/category.service";
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema,
} from "../validators/category.validator";
import { successResponse, paginatedResponse } from "../utils/response";

interface CategoryParams extends Record<string, string> {
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

export async function listCategories(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listCategoriesQuerySchema.parse(req.query);
    const result = await categoryService.listCategories(req.user!.role, query);
    const { currentPage, totalPages, perPage } = result.pagination;
    return paginatedResponse(res, result.categories, result.pagination, {
      self: `/categories?${buildQs(query, currentPage, perPage)}`,
      ...(currentPage < totalPages && {
        next: `/categories?${buildQs(query, currentPage + 1, perPage)}`,
      }),
      ...(currentPage > 1 && {
        prev: `/categories?${buildQs(query, currentPage - 1, perPage)}`,
      }),
    });
  } catch (e) {
    next(e);
  }
}

export async function getCategory(
  req: Request<CategoryParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await categoryService.getCategory(req.params.id),
    );
  } catch (e) {
    next(e);
  }
}

export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = createCategorySchema.parse(req.body);
    return successResponse(
      res,
      await categoryService.createCategory(
        { id: req.user!.sub, role: req.user!.role },
        data,
      ),
      201,
    );
  } catch (e) {
    next(e);
  }
}

export async function updateCategory(
  req: Request<CategoryParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateCategorySchema.parse(req.body);
    return successResponse(
      res,
      await categoryService.updateCategory(
        { id: req.user!.sub, role: req.user!.role },
        req.params.id,
        data,
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function deleteCategory(
  req: Request<CategoryParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    return successResponse(
      res,
      await categoryService.deleteCategory(
        { id: req.user!.sub, role: req.user!.role },
        req.params.id,
      ),
    );
  } catch (e) {
    next(e);
  }
}
