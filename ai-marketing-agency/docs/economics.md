# Economics: Operating Costs, Bottlenecks, and the Business Case

## 1. Operating cost model

Assumptions: **10 active clients**, mid-market retainers, one human operator. API pricing
(per 1M tokens): Opus 4.8 $5 in / $25 out · Sonnet 4.6 $3 / $15 · Haiku 4.5 $1 / $5.
Batches API = 50% off. Prompt-cache reads ≈ 0.1× input price; with disciplined context
recipes we assume **~70% of input tokens served from cache** on the interactive agents
(blended effective input price ≈ 0.37× list).

### LLM cost per month (10 clients)

| Agent / workload | Model | Runs/mo | In / run | Out / run | Raw in (M) | Out (M) | Est. cost/mo |
|---|---|---:|---:|---:|---:|---:|---:|
| CEO planning + approvals + triage | Opus | 900 | 40K | 4K | 36 | 3.6 | $157 in-cached + $90 out ≈ **$157** |
| Strategist (monthly deep + weekly adjust + research) | Opus | 140 | 120K | 10K | 16.8 | 1.4 | $31 + $35 ≈ **$66** |
| Sales (lead convos, proposals) | Opus | 600 | 25K | 3K | 15 | 1.8 | $28 + $45 ≈ **$73** |
| Customer Success (client comms, health) | Opus | 1,200 | 30K | 2.5K | 36 | 3.0 | $67 + $75 ≈ **$142** |
| Media Buyer (3×/day/client opt. passes) | Sonnet | 900 | 35K | 3K | 31.5 | 2.7 | $35 + $41 ≈ **$76** |
| Copywriter (variants, pages, emails, posts) | Sonnet+Opus | 1,500 | 20K | 5K | 30 | 7.5 | $33 + $113 + Opus uplift ≈ **$190** |
| CRM event handling (high volume) | Haiku | 60,000 | 3K | 0.3K | 180 | 18 | $67 + $90 ≈ **$157** |
| CRM sequence drafting | Sonnet | 200 | 15K | 4K | 3 | 0.8 | $3 + $12 ≈ **$15** |
| Reporting nightly (Batches, 50%) | Sonnet | 300 | 80K | 8K | 24 | 2.4 | $36 + $18 ≈ **$54** |
| Memory compaction nightly (Batches) | Haiku | 300 | 50K | 5K | 15 | 1.5 | $8 + $4 ≈ **$12** |
| Embeddings + misc classification | Haiku | — | — | — | ~50 | ~2 | ≈ **$60** |
| **LLM subtotal** | | | | | | | **≈ $1,000/mo** |

Sensitivity: with zero cache discipline this roughly triples (≈$2.6–3K/mo); with sloppy
model routing (everything on Opus) it's ≈$4–5K/mo. **Cache + routing discipline is worth
~$40K/yr at this scale — that's why it's architecture, not optimization.**

### Full monthly P&L view (10 clients)

| Category | Monthly |
|---|---:|
| LLM API (above, with 30% safety margin) | $1,300 |
| SaaS tools (CRM, ESP, analytics/attribution, enrichment, e-sign, BI) | $1,200–2,000 |
| Infrastructure (Postgres, compute, warehouse, object storage, observability) | $300–600 |
| Phone/SMS (Twilio), misc APIs | $150 |
| **Total platform COGS** | **≈ $3,000–4,000/mo** |
| Human operator (1 senior, loaded) | $12,000–15,000 |
| **Total operating cost** | **≈ $15,000–19,000/mo** |

Revenue at 10 clients × $4–8K/mo retainer = **$40–80K/mo** → gross margin 75–90% on
platform COGS; ~60–75% fully loaded with the operator. A traditional agency runs 30–50%
gross margin with linear headcount scaling; here the operator amortizes across 15–25
clients by Phase 3, so margin *expands* with scale.

Per-client platform cost ≈ **$300–400/mo** — about 1.5 hours of one human marketer's
loaded cost.

---

## 2. Bottlenecks (ranked by how much they actually hurt)

1. **The human approval queue.** The single real throughput limit. R3/R4 approvals cluster
   in business hours; a slow operator stalls every client's pipeline.
   *Mitigations*: batch-grouped approvals, earned-autonomy promotion (shrinks ticket volume
   ~70% by Tier 2), approval SLAs with expiry, delegating brand-creative approval to the
   client. *Residual*: ~30 min/client/day at Tier 0 → ~5 min at Tier 2.

2. **Platform API rate limits and bans.** Meta/Google APIs throttle; aggressive mutation
   patterns get ad accounts *flagged*, which is existential for a client.
   *Mitigations*: change-budgets per account per hour in the guardrail service, mutation
   batching, exponential backoff, no-silent-retry rule, human-speed pacing profiles.

3. **Attribution/data quality.** Garbage tracking → confident agents optimizing toward
   noise. This kills client outcomes silently.
   *Mitigations*: Reporting Agent runs tracking-health checks daily (pixel fires, UTM
   integrity, conversion-event volume vs. baseline); any breakage freezes optimization for
   affected campaigns (safe-state) rather than optimizing on bad data.

4. **Context/cost blowup on long-lived clients.** Month-12 clients have enormous histories.
   *Mitigations*: nightly compaction, context recipes with hard token budgets per section,
   semantic retrieval instead of "load everything" (Strategist's monthly deep-dive is the
   one sanctioned full-history load).

5. **LLM latency on event-driven paths.** Hot-lead routing and client-email response are
   latency-sensitive; Opus passes take tens of seconds and a long-horizon planning run can
   take minutes.
   *Mitigations*: Haiku pre-pass acknowledges/classifies in seconds; full-quality response
   follows asynchronously. Nothing latency-critical waits on an Opus deep pass.

6. **Inter-agent thrash loops.** Brief → copy → rejection → revision ping-pong burns tokens
   and time. *Mitigations*: structured briefs with required fields, 2-rejection cap with
   auto-escalation, acceptance criteria validated before claim.

7. **Provider concentration risk.** One model vendor, one API. *Mitigations*: queue-and-
   retry absorbs outages for everything except hot-lead/SEV paths (which degrade to
   template + page-the-human); the audit-log/work-order design is model-agnostic by
   construction.

8. **Trust ramp (cold-start).** New clients won't grant ad-account admin to a robot on day
   one. *Mitigation* is the Tier 0 copilot mode itself — the product *demonstrates*
   judgment via its approval-queue recommendations before it asks for autonomy.

---

## 3. How this realistically replaces a 3–5 person agency

### What a 3–5 person boutique actually is

Typical shape: 1 owner/strategist (also does sales and client management), 1–2 account/media
managers, 1 copywriter/designer, maybe 1 ops/reporting person. Serving 8–15 clients at
$3–10K/mo retainers. Revenue ~$0.5–1.2M/yr, payroll $300–600K, owner margin thin, growth
gated on hiring.

Their week decomposes into work this system covers directly:

| Human role → time | System coverage |
|---|---|
| Account mgmt: status emails, reports, client questions (~40%) | Customer Success + Reporting agents — *better than human*: daily cadence, never forgets a promise, reports ship every Monday 7am |
| Media buying: launches, optimization, pacing (~20%) | Media Buyer — checks every account 3×/day vs. a human's 2–3×/week per account |
| Copy/creative production (~15%) | Copywriter — 12 variants in minutes; systematic testing matrices humans skip under time pressure |
| Strategy (~10%) | Strategist — monthly deep-dives actually happen (in human agencies, strategy decays into reactive tactics by month 4) |
| Sales/proposals (~10%) | Sales Agent — sub-5-minute response to every inbound, ever |
| Ops, CRM hygiene, invoicing chase (~5%) | CRM Agent + billing integration |

### Where the AI is structurally better

- **Coverage**: 24/7 monitoring; a 2am spend anomaly gets paused at 2:04am, not Monday.
- **Consistency**: every client gets the senior playbook every time — boutiques give their
  best clients their best people and the rest get juniors.
- **Memory**: month-old promises, every past test result, full conversation history —
  instantly available, never lost to employee churn (agency #1 killer).
- **Parallelism**: onboarding client #11 doesn't degrade clients #1–10.
- **Economics**: ~$350/client/mo COGS vs. ~$2,500–4,000/client/mo in human labor.

### Where humans stay (and why one operator is enough)

The system deliberately keeps a human for: R4 judgment (pricing, contracts, bad news,
legal/brand risk), relationship moments that need a face (kickoffs, QBRs, save calls),
taste-level creative direction, and accountability (clients need a throat to choke;
regulators and platforms need a responsible party). That workload, with the autonomy
matrix at Tier 2, is **20–40 min/client/week** — one senior operator covers 15–25 clients,
versus 3–4 clients per account manager in the human model.

### The honest version (what to tell investors *and* design partners)

- This replaces the agency's *production and operations capacity*, not its founder's taste
  and relationships — those move into the operator seat and the playbook library.
- Months 1–2 per client are copilot mode: the human approves nearly everything. The
  replacement claim is earned at Tier 2, around month 3, with the approval-rate data to
  prove it.
- Quality bar: the design-partner exit criterion is *flat-or-better KPIs vs. the client's
  prior agency at equal spend, with response times and reporting cadence dramatically
  better*. Win on reliability and coverage first; creative brilliance is the ceiling, not
  the floor.
- The venture story isn't "cheaper agency" — it's that the **playbook library, decision
  log, and autonomy data compound across every client**, which is the thing no 4-person
  shop can ever build: marginal cost per client falls while marginal quality rises.
