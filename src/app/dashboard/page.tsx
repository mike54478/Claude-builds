import { and, avg, count, desc, eq, gte } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  member,
  reviewRequests,
  reviewResponses,
  reviews,
} from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const membership = await db.query.member.findFirst({
    where: eq(member.userId, session.user.id),
  });
  if (!membership) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-2xl font-bold">Welcome to Repruv</h1>
        <p className="mt-3 text-stone-600">
          You&apos;re signed in but not part of an organization yet. Create one
          via the API (<code>POST /api/auth/organization/create</code>) or ask
          your admin for an invite.
        </p>
      </main>
    );
  }
  const orgId = membership.organizationId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [[reviewStats], [requestStats], [pendingDrafts], recentReviews] =
    await Promise.all([
      db
        .select({ total: count(), averageRating: avg(reviews.rating) })
        .from(reviews)
        .where(and(eq(reviews.orgId, orgId), gte(reviews.publishedAt, thirtyDaysAgo))),
      db
        .select({ total: count() })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.orgId, orgId),
            gte(reviewRequests.createdAt, thirtyDaysAgo),
          ),
        ),
      db
        .select({ total: count() })
        .from(reviewResponses)
        .innerJoin(reviews, eq(reviews.id, reviewResponses.reviewId))
        .where(and(eq(reviews.orgId, orgId), eq(reviewResponses.status, "draft"))),
      db.query.reviews.findMany({
        where: eq(reviews.orgId, orgId),
        orderBy: desc(reviews.publishedAt),
        limit: 10,
      }),
    ]);

  const stats = [
    { label: "Reviews (30d)", value: reviewStats?.total ?? 0 },
    {
      label: "Avg rating (30d)",
      value: reviewStats?.averageRating
        ? Number(reviewStats.averageRating).toFixed(2)
        : "—",
    },
    { label: "Requests sent (30d)", value: requestStats?.total ?? 0 },
    { label: "Drafts awaiting approval", value: pendingDrafts?.total ?? 0 },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Latest reviews</h2>
      <ul className="mt-4 space-y-3">
        {recentReviews.length === 0 && (
          <li className="rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-500">
            No reviews ingested yet. Connect a Google profile in Settings →
            Locations, or send your first review requests.
          </li>
        )}
        {recentReviews.map((r) => (
          <li key={r.id} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{r.authorName}</p>
              <p className="text-sm">{"★".repeat(r.rating)}</p>
            </div>
            <p className="mt-1 line-clamp-3 text-sm text-stone-600">{r.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
