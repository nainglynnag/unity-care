import { z } from "zod";

// Emergency Contact
const emergencyContactSchema = z.object({
  name: z.string().min(1, "Contact name is required."),
  phone: z
    .string()
    .regex(
      /^\+?[0-9]{7,15}$/,
      "Phone number must be 7–15 digits and may start with +.",
    ),
  relationship: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
});

// Create Emergency Profile
export const createEmergencyProfileSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  dateOfBirth: z.coerce.date().optional(),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  allergies: z.string().optional(),
  medicalConditions: z.string().optional(),
  medications: z.string().optional(),
  consentGivenAt: z.coerce.date({
    error: "Consent timestamp is required.",
  }),
  contacts: z
    .array(emergencyContactSchema)
    .max(5, "You can add up to 5 emergency contacts.")
    .optional(),
});

// Update Emergency Profile
// All fields are optional — only provided fields will be updated.
// Contacts are NOT replaced on update; manage them separately.
export const updateEmergencyProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required.").optional(),
  dateOfBirth: z.coerce.date().optional(),
  bloodType: z.string().optional(),
  allergies: z.string().optional(),
  medicalConditions: z.string().optional(),
  medications: z.string().optional(),
  consentGivenAt: z.coerce.date().optional(),
  contacts: z
    .array(emergencyContactSchema)
    .max(5, "You can add up to 5 emergency contacts.")
    .optional(),
});

// List Emergency Profiles (admin)
export const listEmergencyProfileQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateEmergencyProfileInput = z.infer<
  typeof createEmergencyProfileSchema
>;
export type UpdateEmergencyProfileInput = z.infer<
  typeof updateEmergencyProfileSchema
>;
export type ListEmergencyProfileQuery = z.infer<
  typeof listEmergencyProfileQuerySchema
>;
