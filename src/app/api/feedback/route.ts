import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { privateFeedback, reviewRequests } from "@/db/schema";

const FeedbackSchema = z.object({
  code: z.string().min(4).max(16),
  rating: z.number().int().min(1).max(5).optional(),
  body: z.string().min(1).max(5000),
});

/** Public endpoint: private feedback submitted from the dual-CTA page. */
export async function POST(req: Request) {
  const parsed = FeedbackSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid_input", message: "Invalid feedback" } },
      { status: 400 },
    );
  }
  const { code, rating, body } = parsed.data;

  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.shortCode, code),
  });
  if (!request) {
    return Response.json(
      { error: { code: "not_found", message: "Unknown link" } },
      { status: 404 },
    );
  }

  await db.insert(privateFeedback).values({
    orgId: request.orgId,
    locationId: request.locationId,
    contactId: request.contactId,
    rating: rating ?? null,
    body,
  });

  await db
    .update(reviewRequests)
    .set({
      status: "feedback_received",
      completedAt: new Date(),
      nextActionAt: null,
    })
    .where(eq(reviewRequests.id, request.id));

  return Response.json({ ok: true });
}
