# Repruv — Strategy & Product Vision

**The one-line pitch:** AI-native reputation management for multi-location local businesses — get more reviews *compliantly*, answer every one of them in your voice within minutes, and turn review text into an operations dashboard your competitors can't see.

---

## 1. Challenging the Reviewnizer concept

Reviewnizer ($139–$249/mo) is an SMS-first review-request tool aimed at single-location local businesses (heavy dental/healthcare flavor — appointment confirmations, X-ray delivery). Three tiers: automated SMS review requests → two-way SMS inbox → promotional blasts. It is a fine 2019-era product. Four structural weaknesses:

### a) Its core mechanic is a compliance time bomb
Reviewnizer's pitch — *"guides happy customers to leave 5-star feedback while addressing issues privately"* — is **review gating**. Google's terms explicitly prohibit "discouraging or prohibiting negative reviews, or selectively soliciting positive reviews." The FTC's 2024 rule on fake/incentivized reviews (16 CFR Part 465) carries civil penalties up to ~$51,744 *per violation*. Google has bulk-deleted reviews from gating tools before; when (not if) enforcement lands, every customer of a gating tool loses their review velocity overnight and the vendor loses its reason to exist.

**Our decision:** We do not gate. We send *everyone* to the public review page, and we run a **parallel, clearly-labeled private feedback channel** ("Tell us how we did" + "Review us on Google" as two honest, simultaneous options). This is compliant, and it reframes the negative review from a thing to suppress into a thing to *win*: a fast, empathetic public response to a 2-star review measurably increases conversion of profile viewers. Compliance is not a constraint we accept reluctantly — it is the moat. We can sell to franchises and DSOs (dental service organizations) whose legal teams will never approve a gating tool.

### b) No AI layer where AI is now the whole job
Reviewnizer collects reviews; it does nothing with them. The two most expensive human tasks in reputation management are (1) writing individual responses to every review and (2) reading hundreds of reviews to figure out *why* ratings are moving. Both are now ~$0.02 LLM calls. A 2026 product that doesn't do response generation, sentiment/topic mining, and competitor benchmarking is selling a mail-merge tool.

### c) Built for one location; the money is in fifty
At $139–249/mo flat, Reviewnizer monetizes a solo dentist. But the buyers with budget, urgency, and zero tolerance for per-location manual work are **multi-location operators**: franchise groups, DSOs, MSOs (med-spa/medical), home-services rollups, and the **agencies** that manage reputation for portfolios of clients. They need roll-up dashboards, location-level benchmarking, centralized response policies with local autonomy, and white-labeling. None of that exists in Reviewnizer.

### d) Single-channel intake (Google only)
Healthcare buyers care about Healthgrades/Zocdoc, home services care about Yelp/Angi/Facebook, restaurants care about TripAdvisor. Multi-source ingestion is table stakes for the segment we want.

---

## 2. Highest-value customer segment

**Primary ICP: multi-location service businesses, 5–100 locations, in "review-decided" verticals** — dental/DSO, med-spa/aesthetics, home services (HVAC, plumbing, roofing), auto services. Secondary ICP (the distribution channel): **local-marketing agencies** managing 10–200 client locations, sold a white-label plan.

Why this segment wins on the path to $100K MRR:

| Factor | Single-location SMB | Multi-location operator / agency |
|---|---|---|
| ACV | $1.7–3K/yr | $12–60K/yr (per-location pricing) |
| Sales motion | High-churn self-serve | 1 buyer → 5–100 locations per close |
| Churn | 4–7%/mo | 1–2%/mo (workflow lock-in, contracts) |
| Willingness to pay for AI responses | "nice" | **mandatory** (nobody answers 400 reviews/mo by hand) |
| Compliance sensitivity | low | high → our no-gating stance is a selling point |

Math: at a blended **$120/location/month**, $100K MRR = **~835 locations = roughly 25–40 logos**. That is a founder-led sales problem, not a paid-acquisition problem — reachable in 2–3 quarters.

---

## 3. Product vision & USP

**Vision:** Every local business answers every customer, publicly, within an hour, in its own voice — and runs operations on what customers actually say.

**USP, in priority order:**

1. **AI Response Engine** — every new review gets a drafted response in the location's configured voice within minutes; positive reviews can auto-publish under a policy, negative reviews route to a human with the draft pre-written. SLA-style metric we put on the dashboard: *median time-to-response*.
2. **Compliant review velocity** — SMS + email request sequences with smart timing, honest dual-CTA (public review + private feedback), per-vertical templates. We market the compliance explicitly: "audit-proof review generation."
3. **Voice-of-Customer analytics** — Claude-powered extraction of sentiment, topics (wait time, billing, staff names, cleanliness…), and entities from every review across all sources; trended per location; roll-up benchmarking ("Location #14's 'wait time' complaints are 3× the portfolio median and rising").
4. **Multi-location + white-label by design** — org → locations hierarchy, roles, per-location settings, agency skin.

**Pricing (decided):**
- **Starter** $99/location/mo — requests, unified inbox, AI drafts (human-approve).
- **Pro** $179/location/mo — auto-publish policies, VoC analytics, benchmarking, integrations (Jobber/ServiceTitan/Dentrix via webhooks/Zapier first).
- **Agency/Enterprise** — volume tiers from $79/location, white-label, API access.
- Per-location volume discounts kick in at 10/25/50. 14-day trial, annual = 2 months free.

**Go-to-market to $100K MRR (sequenced):**
1. **Weeks 1–6:** Founder-led outbound to DSOs and home-services rollups (lists are public — franchise directories, PE rollup announcements). Offer a "reputation audit": we ingest their public reviews and send the VoC report *before* the demo. The audit is generated by our own analytics pipeline → demo = the product.
2. **Weeks 4–12:** Agency channel. 20% recurring margin or wholesale white-label pricing. One agency = 10–50 locations.
3. **Ongoing:** Product-led wedge — free "Review Response Grader" (paste your Google profile, get graded on response rate/time/quality) as the top-of-funnel asset; SEO comparisons ("Reviewnizer alternative", "Birdeye alternative for franchises").
4. Anchor case study per vertical by day 60; vertical landing pages by day 75.

Competitive frame: Birdeye/Podium are the incumbents at $300–500+/location with bloated suites and sales friction; Reviewnizer-class tools are cheap but dumb and non-compliant. We sit in the middle: **AI-first, compliance-first, half the incumbent price.**

---

## 4. Key strategic decisions made (and why)

| Decision | Choice | Reasoning |
|---|---|---|
| Gating | Never | Legal moat; required for franchise/DSO legal sign-off; survives Google enforcement |
| First channel | SMS-first, email fallback | 45× open-rate delta; matches buyer expectation set by incumbents |
| AI model | Claude Opus 4.8 (`claude-opus-4-8`) | Response quality *is* the product; brand-voice fidelity and judgment on negative reviews matter more than inference cost (≈$0.02/review at our volumes — rounding error vs. $99 price) |
| Review ingestion | Google first (API where eligible + licensed data vendor fallback), then Facebook, Yelp | Google = ~73% of local review volume; vendor fallback de-risks API access gating |
| Auto-publish | Policy-gated (rating ≥ N, confidence ≥ X, no flagged topics) with human queue for the rest | Trust is earned; one bad auto-reply to a HIPAA-adjacent review is an account-killer |
| Architecture | Modular monolith (Next.js + Postgres + queues), not microservices | 2 engineers must ship in 90 days; split later along queue boundaries already drawn |
| Healthcare data | Review text + first names only, no PHI ingestion; BAA deferred to post-launch enterprise tier | Lets us sell to dental *marketing* teams day one without HIPAA scope creep |
