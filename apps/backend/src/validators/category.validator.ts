import { z } from "zod";

const booleanFromQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100).trim(),
  description: z.string().max(500).optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field must be provided.",
  });

export const listCategoriesQuerySchema = z.object({
  search: z.string().max(100).optional(),
  isActive: booleanFromQuery,
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
