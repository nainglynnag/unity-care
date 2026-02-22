import { z } from "zod";

const certificateSchema = z.object({
  name: z.string().min(2),
  fileUrl: z.url(),
  issuedBy: z.string().optional(),
  issuedAt: z.iso.date().optional(),
});

export const submitApplicationSchema = z
  .object({
    agencyId: z.uuid("Invalid agency ID"),
    skillIds: z.array(z.uuid()).min(1, "Invalid skill IDs"),
    dateOfBirth: z.iso.date(),
    nationalIdNumber: z.string().min(8, "Invalid national ID number"),
    nationalIdUrl: z.url(),
    address: z.string().min(5, "Invalid address"),
    hasTransport: z.boolean(),
    experience: z
      .string()
      .max(500, "Experience must be less than 500 characters")
      .optional(),
    consentGiven: z.boolean("You must consent to the terms to apply."),
    certificates: z.array(certificateSchema).max(10).optional(),
  })
  .refine(
    (data) => {
      const dob = new Date(data.dateOfBirth);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      return dob <= cutoff;
    },
    {
      message: "You must be at least 18 years old to apply.",
      path: ["dateOfBirth"],
    },
  )
  .refine((data) => data.consentGiven === true, {
    message: "You must consent to the terms to apply.",
    path: ["consentGiven"],
  });

export const updateApplicationSchema = z
  .object({
    agencyId: z.uuid().optional(),
    skillIds: z
      .array(z.uuid())
      .min(1, "At least one skill is required.")
      .optional(),
    dateOfBirth: z.iso.date().optional(),
    nationalIdNumber: z.string().min(8).optional(),
    nationalIdUrl: z.url().optional(),
    address: z.string().min(5).optional(),
    hasTransport: z.boolean().optional(),
    experience: z.string().optional(),
    consentGiven: z.boolean().optional(),
    certificates: z.array(certificateSchema).max(10).optional(),
  })
  .refine(
    (data) => {
      if (!data.dateOfBirth) return true;
      const dob = new Date(data.dateOfBirth);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      return dob <= cutoff;
    },
    {
      message: "You must be at least 18 years old.",
      path: ["dateOfBirth"],
    },
  )
  .refine(
    (data) => data.consentGiven === undefined || data.consentGiven === true,
    {
      message: "You must consent to the terms to apply.",
      path: ["consentGiven"],
    },
  );

export const withdrawApplicationSchema = z.object({});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
