import { type Response } from "express";
import { randomUUID } from "node:crypto";

function baseMeta(success: boolean) {
  return {
    success,
    timestamp: new Date().toISOString(),
    requestId: randomUUID(),
    rateLimit: null,
  };
}

export function successResponse(res: Response, data: any, statusCode = 200) {
  return res.status(statusCode).json({
    meta: baseMeta(true),
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
      ...baseMeta(true),
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
    meta: baseMeta(false),
    data: null,
    error: {
      code,
      message,
      details,
    },
  });
}
