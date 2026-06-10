import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { reviewAnalyses, reviews } from "@/db/schema";
import { analyzeAndStoreReview } from "@/lib/ai/analyze";
import { draftAndStoreResponse } from "@/lib/ai/respond";

export const maxDuration = 300;

/**
 * AI pipeline tick: analyze newly-ingested reviews and pre-draft responses.
 * Idempotent — a review with an analysis row is never reprocessed.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const pending = await db
    .select({ id: reviews.id })
    .from(reviews)
    .leftJoin(reviewAnalyses, eq(reviewAnalyses.reviewId, reviews.id))
    .where(isNull(reviewAnalyses.reviewId))
    .limit(20);

  let analyzed = 0;
  let autoPublished = 0;
  for (const { id } of pending) {
    try {
      await analyzeAndStoreReview(id);
      const { autoPublish } = await draftAndStoreResponse(id);
      analyzed++;
      if (autoPublish) autoPublished++;
    } catch (err) {
      console.error(`analysis failed for review ${id}`, err);
    }
  }

  return Response.json({ pending: pending.length, analyzed, autoPublished });
}
