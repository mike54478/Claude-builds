import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { draftAndStoreResponse } from "@/lib/ai/respond";
import { ApiError, errorResponse, requireOrgContext } from "@/lib/tenant";

/** Generate (or regenerate) an AI response draft for a review. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgContext();
    const { id } = await params;

    // Tenant check before touching the AI pipeline.
    const review = await db.query.reviews.findFirst({
      where: and(eq(reviews.id, id), eq(reviews.orgId, ctx.orgId)),
    });
    if (!review) throw new ApiError(404, "not_found", "Review not found");

    const { stored, draft, autoPublish } = await draftAndStoreResponse(id);
    return Response.json({
      id: stored.id,
      draft: draft.response,
      confidence: draft.confidence,
      reasons: draft.reasons,
      autoPublish,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
