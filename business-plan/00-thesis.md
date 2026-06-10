# FirstRing — The Thesis

**One idea. One bet. My own money on the line.**

## The business

**FirstRing** is an AI phone receptionist for plumbing and HVAC companies (5–50 employees, US).
When the shop can't pick up — after hours, weekends, or when every CSR is on a line — FirstRing
answers on the first ring, triages whether it's an emergency, captures the job details, books the
appointment directly into Housecall Pro / Jobber / ServiceTitan, texts the customer a confirmation,
and texts the owner a summary with the dollar value of the job it just saved.

- **Price:** $199–$799/mo (blended ~$280)
- **Target:** $10,000 MRR = ~38 customers in 180 days
- **Team:** one technical founder, $0 outside capital
- **Motion:** founder-led outbound (cold calls + cold email) into a buyer who answers the phone for a living

## Why this is the highest-probability path to $10k MRR

I evaluated this against every constraint we actually have — $0, one builder, 6 months — and it is
the only category I know where ALL of the following are true at once:

**1. We replace existing spend, we don't create a new budget line.**
Plumbing and HVAC companies already pay $250–$700/mo for human answering services (Ruby, Smith.ai,
AnswerConnect) or pay a CSR overtime to carry the after-hours phone. The hardest part of B2B sales —
convincing someone the problem is worth money — is already done. We are a line-item swap with a
better product: the human answering service takes a message; we book the job.

**2. The ROI math is brutal and provable in week one.**
An average HVAC service ticket runs $400–$600; a replacement job is $5,000–$12,000. Industry studies
consistently find that a large share of calls to home-service SMBs go unanswered (commonly cited at
~60%+ for small businesses; we will measure it ourselves in week 1 — see validation plan), and most
callers who hit voicemail don't leave a message — they call the next plumber on Google. **One saved
job per month pays for FirstRing.** A free trial on their real phone line proves this with their own
revenue numbers inside 14 days. Products that prove ROI inside the trial period close themselves.

**3. The buyer is reachable for $0.**
Plumbers and HVAC owners are not on Product Hunt and don't click LinkedIn ads — but their phone
numbers are public on Google Maps, and answering the phone is literally their business. Cold calling
works on this segment. Better: **the failed cold call is the pitch** — "I called you Tuesday at 2pm
and it rang out. How many of those were customers?" No ad budget required. CAC is founder time.

**4. One technical founder can build the MVP in 3 weeks.**
The voice-AI stack is commoditized in 2026 (telephony + streaming STT + LLM + low-latency TTS, or a
voice pipeline platform to start). Housecall Pro and Jobber both have public APIs for scheduling.
The hard part is not the tech — it's the trade-specific call flows (emergency triage, dispatch-fee
quoting, on-call escalation), which is exactly the defensible part a horizontal player won't do.

**5. The math to $10k MRR is small numbers.**
38 customers. From a market of 200k+ US plumbing/HVAC businesses, that is 0.02% penetration. We need
to close ~1.7 customers/week from month 2 onward. A founder doing 150 cold calls and 250 emails a
week, converting at conservative rates (modeled in `08-financial-model.md`), generates 4–6 demos/week
— enough to hit that with room for churn.

**6. Retention is structural, not hopeful.**
Every booked job generates a real-time text to the owner: *"FirstRing just booked a $450 water-heater
call for Thursday 9am."* The product reports its own ROI weekly in dollars. Churning means going back
to losing those jobs. Target gross churn <3%/mo is realistic because the alternative (human answering
service) costs more and books nothing.

## What I deliberately rejected and why

Not multiple ideas — one idea, but you should know the bar it cleared:

- **Anything consumer / prosumer:** $10k MRR at $20/mo means 500 customers with high churn and no
  outbound channel. Needs paid acquisition. We have $0.
- **Anything sold to startups/SaaS (e.g., AI for security questionnaires, sales tools):** real
  markets, but saturated with AI-native competitors funded 100:1 against us, sold to buyers drowning
  in identical cold emails, with 30–90 day sales cycles. Six months is too short.
- **Dev tools / API products:** developers self-serve, which means content + community + time. The
  growth curve compounds after month 6, not before.
- **Agencies/services-with-AI:** hits $10k fast but it isn't a product business; it doesn't compound
  and it caps at founder hours. We'd be buying a job.

The trades are the last buyer segment where the phone still works, the pain is denominated in
dollars-per-missed-call, and the incumbent solution (human answering services) is strictly worse
than what AI now does. That window is open *right now* — it will be crowded in 24 months, which is
an argument for speed, not avoidance.

## The risks I'm actually worried about (and the mitigation)

| Risk | Mitigation |
|---|---|
| Voice AI flubs a call, owner loses trust | Conservative scope: capture + triage + book, never quote firm prices; warm-transfer true emergencies to the on-call tech; human review of flagged calls in 24h |
| Crowding (Avoca, Sameday, Goodcall, platform-native AI from ServiceTitan/Jobber) | Win on vertical depth + white-glove setup + SMB price point; incumbents chase enterprise/multi-location (see `02-competitive-landscape.md`) |
| Platforms (Jobber/ServiceTitan) ship this natively | Real risk in 12–24 months. Plan: be the best-of-breed integration in their app marketplaces (distribution, not war), and own the customer relationship + multi-system flexibility |
| Trades are slow to trust new tech | Free 14-day trial on after-hours calls only — zero risk, keep your number, conditional call forwarding means nothing changes about their setup |
| Churn from seasonality (HVAC slow seasons) | Annual prepay (2 months free) pushed at close; plumbing is less seasonal; after-hours value persists year-round |

## Document map

| File | Contents |
|---|---|
| `01-market-validation.md` | Validation plan with kill criteria, evidence to date |
| `02-competitive-landscape.md` | Competitor analysis and positioning wedge |
| `03-niche-positioning-pricing.md` | Niche definition, positioning, pricing & packaging |
| `04-mvp-and-roadmap.md` | MVP spec and 6-month product roadmap |
| `05-website-copy.md` | Full website copy, ready to ship |
| `06-sales-funnel-and-outbound.md` | Funnel design + outbound campaigns with scripts |
| `07-onboarding-retention-growth.md` | Onboarding workflow, retention system, growth loops |
| `08-financial-model.md` | Costs, unit economics, conversion-rate model |
| `09-180-day-plan.md` | Weekly milestones, weeks 1–26, with MRR targets |
