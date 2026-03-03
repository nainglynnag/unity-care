import { z } from "zod";

// This helper parses "true"/"false" strings correctly.
const booleanFromQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

export const createSkillSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  description: z.string().max(500).optional(),
});

export const updateSkillSchema = z
  .object({
    name: z.string().min(2).max(80).trim().optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field must be provided.",
  });

export const listSkillsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  isActive: booleanFromQuery,
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
export type ListSkillsQuery = z.infer<typeof listSkillsQuerySchema>;
