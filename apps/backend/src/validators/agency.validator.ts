import { z } from "zod";

const booleanFromQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

export const createAgencySchema = z.object({
  name: z.string().min(2).max(150).trim(),
  description: z.string().max(1000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  region: z.string().max(150),
});

export const updateAgencySchema = z
  .object({
    name: z.string().min(2).max(150).trim().optional(),
    description: z.string().max(1000).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    region: z.string().max(150).optional(),
    isActive: z.boolean().optional(), // SUPERADMIN only — enforced in service
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field must be provided.",
  });

export const listAgenciesQuerySchema = z.object({
  search: z.string().max(100).optional(),
  isActive: booleanFromQuery,
  region: z.string().max(150).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const listAvailableVolunteersQuerySchema = z.object({
  search: z.string().max(100).optional(),
  skillId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["MEMBER", "COORDINATOR", "DIRECTOR"]),
});

export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;
export type ListAgenciesQuery = z.infer<typeof listAgenciesQuerySchema>;
export type ListAvailableVolunteersQuery = z.infer<
  typeof listAvailableVolunteersQuerySchema
>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
