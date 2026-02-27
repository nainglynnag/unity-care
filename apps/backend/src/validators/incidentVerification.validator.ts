import { z } from "zod";

// Assign Verifier
// Used by COORDINATOR/DIRECTOR/SUPERADMIN to dispatch a volunteer to an incident.
// Also reused for retryVerification (same body shape, different status guard).
export const assignVerifierSchema = z.object({
  volunteerId: z.uuid("volunteerId must be a valid UUID."),
});

// retryVerification takes the same body
export const retryVerificationSchema = assignVerifierSchema;

// Submit Verification Result
// Submitted by the assigned volunteer after on-site assessment.
export const submitVerificationSchema = z
  .object({
    decision: z.enum(["VERIFIED", "UNREACHABLE", "FALSE_REPORT"], {
      message: "decision must be VERIFIED, UNREACHABLE, or FALSE_REPORT.",
    }),
    comment: z
      .string()
      .min(5, "Comment must be at least 5 characters.")
      .optional(),
    media: z
      .array(
        z.object({
          url: z.url("Each media item must have a valid URL."),
          mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO"], {
            message: "mediaType must be IMAGE, VIDEO, or AUDIO.",
          }),
        }),
      )
      .max(5, "You can attach up to 5 media files."),
  })
  .refine(
    (data) =>
      data.decision === "VERIFIED" ||
      (data.comment !== undefined && data.comment.length >= 5),
    {
      message:
        "A comment is required when marking as UNREACHABLE or FALSE_REPORT.",
      path: ["comment"],
    },
  );

// Confirm Verification Result
// Used by COORDINATOR/DIRECTOR/SUPERADMIN after reviewing volunteer's submission.
// confirmed=true  -> incident status advances to volunteer's decision
// confirmed=false -> submission rejected, verification re-assigned to same volunteer
// confirmNote: mandatory when confirmed=false (volunteer needs to know why)
export const confirmVerificationSchema = z
  .object({
    confirmed: z.boolean({
      message: "confirmed is required.",
    }),
    confirmNote: z
      .string()
      .min(5, "Confirm note must be at least 5 characters.")
      .optional(),
  })
  .refine(
    (data) =>
      data.confirmed === true ||
      (data.confirmNote !== undefined && data.confirmNote.length >= 5),
    {
      message: "A note is required when rejecting a verification submission.",
      path: ["confirmNote"],
    },
  );

export type AssignVerifierInput = z.infer<typeof assignVerifierSchema>;
export type RetryVerificationInput = z.infer<typeof retryVerificationSchema>;
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
export type ConfirmVerificationInput = z.infer<
  typeof confirmVerificationSchema
>;
