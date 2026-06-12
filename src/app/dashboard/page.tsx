import {
  DEMO_MODE,
  demoBusiness,
  demoReviews,
  demoStats,
  demoTopics,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (DEMO_MODE) return <DemoDashboard />;
  return <LiveDashboard />;
}

/* ------------------------------------------------------------------ */
/* Demo mode — zero external services required                         */
/* ------------------------------------------------------------------ */

const statusStyles: Record<string, string> = {
  "auto-published": "bg-emerald-100 text-emerald-800",
  "awaiting approval": "bg-amber-100 text-amber-800",
  "blocked — human review required": "bg-red-100 text-red-800",
};

const sentimentStyles: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  negative: "bg-red-50 text-red-700 border-red-200",
  mixed: "bg-amber-50 text-amber-700 border-amber-200",
};

function DemoDashboard() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
        <strong>Demo mode</strong> — sample data for {demoBusiness.name} (
        {demoBusiness.city}, {demoBusiness.locations.length} locations). Also
        try the customer-facing page:{" "}
        <a href="/r/demo" className="font-medium underline">
          what your customers see →
        </a>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{demoBusiness.name}</h1>
          <p className="text-sm text-stone-500">
            All locations · Last 30 days
          </p>
        </div>
        <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white">
          REPRUV
        </span>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {demoStats.map((s) => (
          <div key={s.label} className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        {/* Reviews inbox */}
        <section className="lg:col-span-3">
          <h2 className="text-lg font-semibold">Reviews inbox</h2>
          <p className="text-sm text-stone-500">
            Every new review gets an AI-drafted response within minutes.
          </p>
          <ul className="mt-4 space-y-4">
            {demoReviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {r.author}
                    <span className="ml-2 font-normal text-stone-400">
                      {r.location} · {r.age}
                    </span>
                  </p>
                  <p className="shrink-0 text-sm text-amber-500">
                    {"★".repeat(r.rating)}
                    <span className="text-stone-200">{"★".repeat(5 - r.rating)}</span>
                  </p>
                </div>
                <p className="mt-2 text-sm text-stone-700">{r.body}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${sentimentStyles[r.sentiment]}`}
                  >
                    {r.sentiment}
                  </span>
                  {r.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs text-stone-600"
                    >
                      {t.replaceAll("_", " ")}
                    </span>
                  ))}
                  {r.flags.map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                    >
                      ⚑ {f.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>

                <div className="mt-3 rounded-lg bg-stone-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-stone-500">
                      AI RESPONSE · confidence {Math.round(r.confidence * 100)}%
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[r.draftStatus]}`}
                    >
                      {r.draftStatus}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-stone-700">{r.draft}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Voice of customer */}
        <section className="lg:col-span-2">
          <h2 className="text-lg font-semibold">Voice of customer</h2>
          <p className="text-sm text-stone-500">
            What 128 reviews said this month, extracted by AI.
          </p>
          <ul className="mt-4 space-y-3">
            {demoTopics.map((t) => {
              const total = t.positive + t.negative;
              const pct = Math.round((t.positive / total) * 100);
              return (
                <li key={t.topic} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium">{t.topic}</p>
                    <p className="text-xs text-stone-500">
                      {total} mentions · {t.trend} vs last month
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-red-100">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {t.positive} positive · {t.negative} negative
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">⚠ This month&apos;s signal</p>
            <p className="mt-1">
              &ldquo;Wait time&rdquo; complaints at Round Rock are 3× the
              portfolio median and rising — 9 of 12 negative mentions name
              afternoon appointments.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Live mode — real data (requires DATABASE_URL etc.)                  */
/* ------------------------------------------------------------------ */

async function LiveDashboard() {
  // Imports stay inside the live branch so demo mode never touches db/auth.
  const [{ headers }, { redirect }, { db }, schema, { auth }, drizzle] =
    await Promise.all([
      import("next/headers"),
      import("next/navigation"),
      import("@/db"),
      import("@/db/schema"),
      import("@/lib/auth"),
      import("drizzle-orm"),
    ]);
  const { member, reviewRequests, reviewResponses, reviews } = schema;
  const { and, avg, count, desc, eq, gte } = drizzle;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const membership = await db.query.member.findFirst({
    where: eq(member.userId, session!.user.id),
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
    { label: "Reviews (30d)", value: String(reviewStats?.total ?? 0) },
    {
      label: "Avg rating (30d)",
      value: reviewStats?.averageRating
        ? Number(reviewStats.averageRating).toFixed(2)
        : "—",
    },
    { label: "Requests sent (30d)", value: String(requestStats?.total ?? 0) },
    { label: "Drafts awaiting approval", value: String(pendingDrafts?.total ?? 0) },
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
