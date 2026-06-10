import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { member } from "@/db/schema";
import { auth } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type OrgContext = {
  userId: string;
  orgId: string;
  role: string;
};

/**
 * Tenant guard: every authenticated API route resolves its org context
 * through here. Data access below this layer always filters by orgId —
 * route handlers never query tenant tables without it.
 */
export async function requireOrgContext(orgIdOverride?: string): Promise<OrgContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ApiError(401, "unauthenticated", "Sign in required");

  const orgId =
    orgIdOverride ?? (session.session.activeOrganizationId as string | null | undefined);
  if (!orgId) {
    throw new ApiError(400, "no_active_org", "No active organization selected");
  }

  const membership = await db.query.member.findFirst({
    where: and(eq(member.userId, session.user.id), eq(member.organizationId, orgId)),
  });
  if (!membership) {
    throw new ApiError(403, "forbidden", "Not a member of this organization");
  }

  return { userId: session.user.id, orgId, role: membership.role };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  console.error(err);
  return Response.json(
    { error: { code: "internal", message: "Something went wrong" } },
    { status: 500 },
  );
}
