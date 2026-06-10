import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { enqueueReviewRequests } from "@/lib/requests";
import { errorResponse, requireOrgContext } from "@/lib/tenant";

const CreateSchema = z.object({
  locationId: z.string(),
  contactIds: z.array(z.string()).min(1).max(500),
  sequenceId: z.string().optional(),
});

/** Enqueue review requests; the cron scheduler sends them. */
export async function POST(req: Request) {
  try {
    const ctx = await requireOrgContext();
    const input = CreateSchema.parse(await req.json());

    const created = await enqueueReviewRequests({
      orgId: ctx.orgId,
      locationId: input.locationId,
      contactIds: input.contactIds,
      sequenceId: input.sequenceId,
    });

    return Response.json({ enqueued: created }, { status: 202 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: { code: "invalid_input", message: err.message } },
        { status: 400 },
      );
    }
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  try {
    const ctx = await requireOrgContext();
    const status = new URL(req.url).searchParams.get("status");

    const rows = await db.query.reviewRequests.findMany({
      where: status
        ? and(
            eq(reviewRequests.orgId, ctx.orgId),
            eq(reviewRequests.status, status as never),
          )
        : eq(reviewRequests.orgId, ctx.orgId),
      orderBy: desc(reviewRequests.createdAt),
      limit: 100,
    });
    return Response.json({ requests: rows });
  } catch (err) {
    return errorResponse(err);
  }
}
