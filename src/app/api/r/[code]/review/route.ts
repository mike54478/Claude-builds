import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, reviewRequests } from "@/db/schema";

/** Public: "Leave a review" click → record conversion → redirect to Google. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.shortCode, code),
  });
  if (!request) return new Response("Not found", { status: 404 });

  const location = await db.query.locations.findFirst({
    where: eq(locations.id, request.locationId),
  });
  const target =
    location?.reviewLink ??
    (location?.googlePlaceId
      ? `https://search.google.com/local/writereview?placeid=${location.googlePlaceId}`
      : null);
  if (!target) return new Response("Review link not configured", { status: 404 });

  await db
    .update(reviewRequests)
    .set({
      status: "clicked_review",
      clickedAt: request.clickedAt ?? new Date(),
      nextActionAt: null, // stop reminders once they convert
      completedAt: new Date(),
    })
    .where(eq(reviewRequests.id, request.id));

  return Response.redirect(target, 302);
}
