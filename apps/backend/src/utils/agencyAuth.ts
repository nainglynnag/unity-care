import { prisma } from "../lib/prisma";
import { AgencyRole } from "../../generated/prisma/client";
import { ForbiddenError } from "./errors";

export type RequesterContext = {
  id: string; // userId
  role: string; // JWT role
};

// Returns null for SUPERADMIN (unrestricted).
// Returns { agencyId, agencyRole } for COORDINATOR or DIRECTOR.
// Throws ForbiddenError for any other role.
export async function resolveWriteAuthority(
  requester: RequesterContext,
): Promise<{ agencyId: string; agencyRole: AgencyRole } | null> {
  if (requester.role === "SUPERADMIN") return null;

  if (requester.role !== "VOLUNTEER") throw new ForbiddenError();

  const membership = await prisma.agencyMember.findFirst({
    where: {
      userId: requester.id,
      role: { in: [AgencyRole.COORDINATOR, AgencyRole.DIRECTOR] },
    },
    select: { agencyId: true, role: true },
  });

  if (!membership) throw new ForbiddenError();
  return { agencyId: membership.agencyId, agencyRole: membership.role };
}
