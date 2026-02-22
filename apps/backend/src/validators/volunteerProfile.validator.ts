import { z } from "zod";

export const updateVolunteerProfileSchema = z
  .object({
    availabilityRadiusKm: z.number().min(1).max(500).optional(),
    lastKnownLatitude: z.number().min(-90).max(90).optional(),
    lastKnownLongitude: z.number().min(-180).max(180).optional(),
    skillIds: z.array(z.uuid()).optional(),
  })
  .refine(
    (d) =>
      (d.lastKnownLatitude !== undefined) ===
      (d.lastKnownLongitude !== undefined),
    {
      message: "Both Latitude and Longitude are required.",
      path: ["lastKnownLatitude"],
    },
  );

export const updateAvailabilitySchema = z
  .object({
    isAvailable: z.boolean({
      message: "You need to confirm Available or not.",
    }),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine((d) => (d.latitude !== undefined) === (d.longitude !== undefined), {
    message: "Both Latitude and Longitude are required.",
    path: ["latitude"],
  });

export type UpdateVolunteerProfileInput = z.infer<
  typeof updateVolunteerProfileSchema
>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
