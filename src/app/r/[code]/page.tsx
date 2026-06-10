import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { locations, reviewRequests } from "@/db/schema";
import { FeedbackForm } from "./feedback-form";

/**
 * The dual-CTA page. Compliance lives here: BOTH options are always shown
 * to EVERY recipient, regardless of how we think they feel. Public review
 * and private feedback are parallel channels, never a filter.
 */
export default async function RequestLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.shortCode, code),
  });
  if (!request) notFound();

  const location = await db.query.locations.findFirst({
    where: eq(locations.id, request.locationId),
  });
  if (!location) notFound();

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">How did we do?</h1>
      <p className="mt-2 text-stone-600">
        Thanks for choosing {location.name}. Your feedback helps us — either way
        you share it.
      </p>

      <a
        href={`/api/r/${code}/review`}
        className="mt-8 block rounded-xl bg-stone-900 px-5 py-4 text-center font-medium text-white hover:bg-stone-700"
      >
        ⭐ Leave a public review
      </a>

      <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
        <div className="h-px flex-1 bg-stone-200" />
        or
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <FeedbackForm code={code} businessName={location.name} />
    </main>
  );
}
