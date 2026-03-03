import { z } from "zod";

// Update Profile
// name, profileImageUrl and (optionally) phone.
// Phone/email verification is not implemented yet — keep usage minimal.
// At least one field required to prevent no-op requests.
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters.")
      .max(100, "Name cannot exceed 100 characters.")
      .optional(),
    profileImageUrl: z.url("profileImageUrl must be a valid URL.").optional(),
    phone: z
      .string()
      .regex(
        /^\+?[0-9]{7,15}$/,
        "Phone number must be 7–15 digits and may start with +.",
      )
      .optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.profileImageUrl !== undefined ||
      d.phone !== undefined,
    {
      message:
        "At least one field (name, profileImageUrl or phone) must be provided.",
    },
  );

// Update Password (self-service, all roles)
// currentPassword ALWAYS required. No privileged bypass.
// refreshToken required so the service can keep the current session alive
// while revoking all other sessions.
export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "currentPassword is required."),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters."),
    confirmNewPassword: z.string().min(1, "confirmNewPassword is required."),
    refreshToken: z.string().min(1, "refreshToken is required."),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "Passwords do not match.",
    path: ["confirmNewPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
  });

// Sign Out
// Revokes the specific refresh token supplied (current device).
export const signOutSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required."),
});

// SUPERADMIN: Reset Password
// Privileged credential override. No currentPassword required.
// deactivate (default true): true = lockout, false = support reset.
// Cannot target SUPERADMIN accounts or self.
export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters."),
    confirmNewPassword: z.string().min(1, "confirmNewPassword is required."),
    deactivate: z.boolean().default(true),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "Passwords do not match.",
    path: ["confirmNewPassword"],
  });

// SUPERADMIN: Update Account Status
// Activate or deactivate without touching credentials.
// Deactivating revokes all refresh tokens immediately.
export const updateAccountStatusSchema = z.object({
  isActive: z.boolean({ error: "isActive (boolean) is required." }),
  reason: z
    .string()
    .min(5, "Please provide a reason (min 5 characters).")
    .optional(),
});

// SUPERADMIN: List Users
// Includes soft-deleted accounts. SUPERADMIN needs full visibility.
// search: case-insensitive partial match on name OR email.
export const listUsersQuerySchema = z.object({
  role: z.enum(["CIVILIAN", "VOLUNTEER", "ADMIN", "SUPERADMIN"]).optional(),
  isActive: z
    .enum(["true", "false"], { error: "isActive must be 'true' or 'false'." })
    .transform((v) => v === "true")
    .optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type SignOutInput = z.infer<typeof signOutSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateAccountStatusInput = z.infer<
  typeof updateAccountStatusSchema
>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
