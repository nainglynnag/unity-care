import { type Response } from "express";
import { randomUUID } from "node:crypto";

function extractRateLimit(res: Response) {
  const header = res.getHeader("RateLimit");
  if (!header) return null;

  const parts = String(header).split(",");
  const map: Record<string, number> = {};
  for (const part of parts) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key && value !== undefined) map[key] = Number(value);
  }

  const retryAfter = res.getHeader("Retry-After");

  return {
    limit: map.limit ?? 0,
    remaining: map.remaining ?? 0,
    reset: map.reset ?? 0,
    ...(retryAfter !== undefined && { retryAfter: Number(retryAfter) }),
  };
}

function baseMeta(res: Response, success: boolean) {
  return {
    success,
    timestamp: new Date().toISOString(),
    requestId: randomUUID(),
    rateLimit: extractRateLimit(res),
  };
}

export function successResponse(res: Response, data: any, statusCode = 200) {
  return res.status(statusCode).json({
    meta: baseMeta(res, true),
    data,
  });
}

export function paginatedResponse(
  res: Response,
  data: any[],
  pagination: {
    totalPages: number;
    totalRecords: number;
    currentPage: number;
    perPage: number;
  },
  links: Record<string, string>,
  statusCode = 200,
) {
  return res.status(statusCode).json({
    meta: {
      ...baseMeta(res, true),
      pagination,
    },
    data,
    links,
  });
}

export function errorResponse(
  res: Response,
  code: string,
  message: string,
  details: any[] = [],
  statusCode = 400,
) {
  return res.status(statusCode).json({
    meta: baseMeta(res, false),
    data: null,
    error: {
      code,
      message,
      details,
    },
  });
}
