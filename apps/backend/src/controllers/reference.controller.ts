import { type Request, type Response, type NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { successResponse } from "../utils/response";

export async function listAgencies(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const agencies = await prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, region: true },
    });
    return successResponse(res, { agencies });
  } catch (error) {
    next(error);
  }
}

export async function listSkills(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return successResponse(res, { skills });
  } catch (error) {
    next(error);
  }
}
