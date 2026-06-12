"use client";

import { useState } from "react";

export function FeedbackForm({
  code,
  businessName,
  demo = false,
}: {
  code: string;
  businessName: string;
  demo?: boolean;
}) {
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (demo) {
      setState("done");
      return;
    }
    setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, body, rating: rating ?? undefined }),
    });
    setState(res.ok ? "done" : "error");
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Thank you — your message went straight to the {businessName} team.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-stone-200 bg-white p-5">
      <p className="text-sm font-medium">Send private feedback to the team</p>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className={`text-2xl ${rating && n <= rating ? "opacity-100" : "opacity-30"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Tell us what happened…"
        className="mt-3 h-28 w-full rounded-lg border border-stone-300 p-3 text-sm"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-3 w-full rounded-lg border border-stone-900 px-4 py-2.5 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send privately"}
      </button>
      {state === "error" && (
        <p className="mt-2 text-sm text-red-600">Something went wrong — try again.</p>
      )}
    </form>
  );
}
