import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="mb-6 text-sm font-semibold tracking-wide text-emerald-700">
        REPRUV
      </p>
      <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Every review answered.
        <br />
        Every location accountable.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-stone-600">
        AI-native reputation management for multi-location businesses. Get more
        reviews <em>compliantly</em>, publish on-brand responses in minutes, and
        turn review text into an operations dashboard.
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:bg-stone-700"
        >
          View live demo
        </Link>
        <Link
          href="/r/demo"
          className="rounded-lg border border-stone-300 px-5 py-3 text-sm font-medium hover:bg-stone-100"
        >
          See what customers get
        </Link>
      </div>
      <div className="mt-20 grid gap-8 sm:grid-cols-3">
        {[
          {
            title: "Audit-proof review velocity",
            body: "SMS + email sequences with an honest dual CTA. No gating — ever. Built to survive Google and FTC scrutiny.",
          },
          {
            title: "AI responses in your voice",
            body: "Claude drafts every reply in your brand voice. Auto-publish the safe ones; humans approve the rest.",
          },
          {
            title: "Voice-of-customer analytics",
            body: "Sentiment, topics, and staff mentions across every location — benchmarked, trended, and actionable.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-stone-600">{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
