import { notFound } from "next/navigation";
import { DEMO_MODE, demoBusiness } from "@/lib/demo";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";

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

  // Demo: what a customer sees after receiving a review-request text.
  if (code === "demo" || DEMO_MODE) {
    return (
      <Page
        businessName={demoBusiness.name}
        code="demo"
        reviewHref="#"
        demo
      />
    );
  }

  const [{ db }, { locations, reviewRequests }, { eq }] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
    import("drizzle-orm"),
  ]);

  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.shortCode, code),
  });
  if (!request) notFound();

  const location = await db.query.locations.findFirst({
    where: eq(locations.id, request.locationId),
  });
  if (!location) notFound();

  return (
    <Page
      businessName={location.name}
      code={code}
      reviewHref={`/api/r/${code}/review`}
    />
  );
}

function Page({
  businessName,
  code,
  reviewHref,
  demo = false,
}: {
  businessName: string;
  code: string;
  reviewHref: string;
  demo?: boolean;
}) {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      {demo && (
        <p className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
          <strong>Demo</strong> — this is the page your customer lands on from
          the review-request text. <a href="/dashboard" className="underline">Back to dashboard</a>
        </p>
      )}
      <h1 className="text-2xl font-bold">How did we do?</h1>
      <p className="mt-2 text-stone-600">
        Thanks for choosing {businessName}. Your feedback helps us — either way
        you share it.
      </p>

      <a
        href={reviewHref}
        className="mt-8 block rounded-xl bg-stone-900 px-5 py-4 text-center font-medium text-white hover:bg-stone-700"
      >
        ⭐ Leave a public review
        {demo && <span className="block text-xs font-normal text-stone-300">(goes to Google in the real product)</span>}
      </a>

      <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
        <div className="h-px flex-1 bg-stone-200" />
        or
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <FeedbackForm code={code} businessName={businessName} demo={demo} />
    </main>
  );
}
