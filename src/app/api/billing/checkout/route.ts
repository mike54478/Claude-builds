import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, organization, user } from "@/db/schema";
import { createCheckoutSession } from "@/lib/stripe";
import { ApiError, errorResponse, requireOrgContext } from "@/lib/tenant";

const InputSchema = z.object({ plan: z.enum(["starter", "pro"]) });

export async function POST(req: Request) {
  try {
    const ctx = await requireOrgContext();
    if (!["owner", "admin"].includes(ctx.role)) {
      throw new ApiError(403, "forbidden", "Only owners/admins can manage billing");
    }
    const { plan } = InputSchema.parse(await req.json());

    const [org, me, [{ value: locationCount }]] = await Promise.all([
      db.query.organization.findFirst({ where: eq(organization.id, ctx.orgId) }),
      db.query.user.findFirst({ where: eq(user.id, ctx.userId) }),
      db.select({ value: count() }).from(locations).where(eq(locations.orgId, ctx.orgId)),
    ]);
    if (!org || !me) throw new ApiError(404, "not_found", "Organization not found");

    const { url } = await createCheckoutSession({
      orgId: ctx.orgId,
      customerEmail: me.email,
      stripeCustomerId: org.stripeCustomerId,
      plan,
      locationQuantity: Math.max(1, locationCount),
    });
    return Response.json({ url });
  } catch (err) {
    return errorResponse(err);
  }
}
