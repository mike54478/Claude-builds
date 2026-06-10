# Agent Specifications

Eight agents. Each spec covers: responsibilities, inputs, outputs, tools required,
memory requirements, and decision-making process. Model assignments follow the
"right model for the job" principle (see `economics.md` for the cost rationale):

| Agent | Model | Why |
|---|---|---|
| CEO | `claude-opus-4-8` | Highest-stakes judgment: goal decomposition, conflict resolution, escalation triage |
| Sales | `claude-opus-4-8` | Revenue-critical conversations; nuanced qualification and pricing judgment |
| Marketing Strategist | `claude-opus-4-8` | Long-horizon planning, cross-channel reasoning |
| Media Buying | `claude-sonnet-4-6` | High-frequency, structured optimization decisions inside hard guardrails |
| Copywriting | `claude-sonnet-4-6` (drafts) + `claude-opus-4-8` (flagship assets) | Volume work at Sonnet cost; hero assets get Opus |
| CRM Automation | `claude-haiku-4-5` (routing) + `claude-sonnet-4-6` (sequence writing) | Mostly classification and templated generation |
| Reporting | `claude-sonnet-4-6` via **Batches API** | Overnight, non-latency-sensitive → 50% batch discount |
| Customer Success | `claude-opus-4-8` | Churn-risk conversations are revenue-critical |

---

## 1. CEO Agent (Orchestrator)

The only agent with a global view. It does not do marketing work; it allocates it.

**Responsibilities**
- Decompose client goals ("grow qualified pipeline 30% in Q3") into agent work orders with budgets, deadlines, and success metrics.
- Run the daily planning cycle: review yesterday's KPIs, reprioritize today's task queue.
- Resolve conflicts between agents (e.g., Media Buyer wants budget the Strategist allocated elsewhere).
- Own the escalation queue — decide what reaches the human operator and with what urgency.
- Approve or reject mid-tier actions within its delegated authority (see approval tiers in `system-design.md`).
- Monitor agency-level health: client profitability, agent error rates, spend vs. budget pacing.

**Inputs**
- Client goals, contracts, and budget envelopes (from onboarding / Sales handoff).
- Daily KPI digest from the Reporting Agent.
- Escalation events from all agents.
- Approval requests above other agents' autonomy thresholds.
- Human operator directives (highest priority, override everything).

**Outputs**
- Work orders (typed tasks with budget, deadline, acceptance criteria) onto the event bus.
- Budget allocations and reallocations per client per channel.
- Escalation tickets to the human operator with a recommended decision.
- Weekly agency operating review (written to memory + emailed to operator).

**Tools required**
- `create_work_order`, `reallocate_budget`, `escalate_to_human` (internal)
- `read_kpi_dashboard` (Reporting service)
- `read_client_record`, `update_client_record` (memory layer)
- Calendar/scheduler API (cron-style planning triggers)

**Memory requirements**
- **Read**: full client records, all agent run summaries, KPI history, playbooks.
- **Write**: work orders, decisions log (every allocation decision with rationale), weekly reviews.
- Long-lived working memory: a per-client "operating thesis" document it revises weekly.

**Decision-making process**
1. Pull client goal + current KPI snapshot + budget pacing from memory.
2. Adaptive-thinking pass: diagnose the gap between trajectory and goal.
3. Generate 2–3 candidate interventions; score against expected impact, cost, and risk.
4. Anything within delegated authority → emit work orders. Anything touching money above
   tier limits, legal/brand risk, or contract changes → approval request or escalation.
5. Write decision + rationale to the decisions log (this log is the training set for
   future playbook refinement).

---

## 2. Sales Agent

Owns top-of-funnel for the *agency itself*: inbound leads, qualification, proposals, closing.

**Responsibilities**
- Respond to inbound inquiries within minutes, 24/7.
- Qualify leads (budget, authority, need, timeline) via email/chat conversation.
- Generate tailored proposals and pricing from the agency's rate card and capacity model.
- Schedule and prep discovery calls for the human operator when deal size warrants it.
- Negotiate within pre-approved discount bands; hand off signed clients to onboarding.

**Inputs**
- Inbound leads (web form, email, chat widget) via webhook.
- Agency rate card, capacity model, and ICP definition (memory).
- CRM history for returning contacts.
- Win/loss notes from past deals (memory).

**Outputs**
- Qualified lead records in CRM with BANT scoring.
- Proposals (PDF/doc) — **gated**: sent only after approval if above value threshold.
- Meeting bookings on the operator's calendar.
- Signed-deal handoff packet → CEO Agent (goals, budget, contacts, contract terms).

**Tools required**
- Email send/receive (Gmail/SendGrid API), chat widget API
- CRM read/write (HubSpot/Attio API)
- Calendar booking (Calendly/Google Calendar API)
- Document generation (proposal templates), e-signature (DocuSign/PandaDoc)
- `escalate_to_human`, `request_approval`

**Memory requirements**
- **Read**: rate card, ICP, objection-handling playbook, win/loss history, full thread history per contact.
- **Write**: every conversation turn to the contact's CRM timeline; win/loss notes on deal close.
- Conversation state must survive multi-day email threads (thread-keyed memory).

**Decision-making process**
1. Classify inbound: ICP fit score (fast Haiku pre-pass), spam/low-fit auto-archived with polite decline.
2. For fits: conversational qualification, one question per email, never more than 2 unanswered follow-ups.
3. Pricing: select package from rate card; discounts ≤10% autonomous, 10–20% needs CEO Agent
   approval, >20% or custom terms escalate to human.
4. Proposal > $X/month → human reviews before send (approval queue).
5. No response after sequence completes → mark dormant, schedule 90-day re-engagement.

---

## 3. Marketing Strategist Agent

The "brain" for each client account. Turns goals into channel strategy.

**Responsibilities**
- Build and maintain the per-client marketing strategy: positioning, ICP, channel mix, budget split, content calendar themes, experiment roadmap.
- Run quarterly/monthly planning; adjust strategy from Reporting Agent data.
- Design experiments (A/B tests, new channel pilots) with hypotheses and kill criteria.
- Competitive and market research (web search + analysis).
- Brief the Copywriting and Media Buying agents (creative briefs, campaign briefs).

**Inputs**
- Client goals + operating thesis from CEO Agent.
- Performance data and experiment results from Reporting Agent.
- Market/competitor research (web search, ad libraries).
- Brand guidelines and historical creative performance (memory).

**Outputs**
- Strategy document per client (versioned in memory).
- Campaign briefs → Media Buying Agent. Creative briefs → Copywriting Agent.
- Experiment definitions with success metrics and kill criteria.
- Monthly strategy memo → CEO Agent + client-facing version → Customer Success Agent.

**Tools required**
- Web search / web fetch (server-side tools)
- Meta Ad Library / Google Ads transparency APIs (competitor research)
- Analytics read (GA4, attribution platform)
- `publish_brief`, `define_experiment` (internal)
- Memory read/write

**Memory requirements**
- **Read**: everything about the client — goals, brand, all historical performance, past experiments and outcomes (crucial: never re-run a failed experiment without new justification).
- **Write**: strategy versions with change rationale, briefs, experiment registry.
- Needs the *longest* context of any agent — strategy sessions load the full client history (1M context window on Opus 4.8 makes this viable without aggressive summarization).

**Decision-making process**
1. Monthly cadence (or triggered by CEO work order / significant KPI deviation).
2. Load full client memory + fresh research; adaptive thinking at high effort.
3. Produce strategy diff, not a rewrite: what changes, why, expected impact, risk.
4. Strategy changes that move >25% of monthly budget between channels require CEO Agent
   sign-off; >40% or new-channel entry requires human approval.
5. Register experiments in the experiment registry so Reporting evaluates them automatically.

---

## 4. Media Buying Agent

Hands on the ad platforms. Highest-frequency decision loop, tightest guardrails.

**Responsibilities**
- Launch campaigns from Strategist briefs (audiences, placements, bids, budgets).
- Continuous optimization: pause losers, scale winners, adjust bids, rotate creative.
- Budget pacing: never overspend the monthly envelope; flag underspend.
- Creative testing operations (deploy Copywriter variants, manage test cells).
- Platform hygiene: disapprovals, policy flags, tracking/pixel health.

**Inputs**
- Campaign briefs + budget envelopes from Strategist (via CEO-approved work orders).
- Hourly/daily platform performance data (Meta, Google, LinkedIn, TikTok APIs).
- Creative assets from Copywriting Agent.
- Guardrail config: max daily spend per client, max bid, min ROAS kill thresholds.

**Outputs**
- Live campaigns and change logs (every platform mutation logged with rationale).
- Daily pacing report → Reporting Agent + CEO Agent.
- Creative performance feedback → Copywriting Agent ("hook A outperforms B by 2.1x").
- Anomaly alerts (spend spike, CPA blowout, account flag) → escalation path.

**Tools required**
- Meta Marketing API, Google Ads API, LinkedIn/TikTok Ads APIs
- Spend-guardrail service (hard, code-enforced caps — *not* LLM-enforced)
- Analytics/attribution read
- `request_approval`, `escalate_to_human`

**Memory requirements**
- **Read**: campaign briefs, guardrails, creative library with performance tags, platform-specific playbooks (e.g., "this client's Meta account has a learning-phase sensitivity").
- **Write**: every change with before/after state and rationale; daily account snapshots.
- Short-horizon working memory: last 14 days of hourly metrics per campaign (the rest aggregated).

**Decision-making process**
1. Scheduled optimization passes (e.g., 3×/day) + event-triggered passes (anomaly webhook).
2. Rule-checked first: code-level guardrails evaluate every proposed mutation *before* the
   platform API call. The LLM proposes; the guardrail service disposes.
3. Autonomy tiers: budget shifts ≤15% of campaign daily budget — autonomous. 15–50% — CEO
   Agent approval. New campaign launch or >50% — human approval (first 60 days of a client;
   relaxes to CEO approval after trust is established).
4. Kill criteria are mechanical: CPA > 2× target for 3 consecutive days → auto-pause + notify.
5. Every decision references the experiment registry so tests aren't contaminated mid-flight.

---

## 5. Copywriting Agent

All words, all formats: ads, landing pages, emails, social, blogs.

**Responsibilities**
- Produce copy from creative briefs: ad variants (hooks/bodies/CTAs), landing pages, email sequences, organic social, long-form content.
- Maintain and apply each client's brand voice profile.
- Systematic variant generation for testing (structured matrices: 4 hooks × 3 angles × 2 CTAs).
- Revise based on performance feedback from Media Buying and CRM agents.
- Compliance pre-check (platform ad policies, regulated-industry claims).

**Inputs**
- Creative briefs from Strategist; variant requests from Media Buyer.
- Brand voice profile + approved/forbidden claims list (memory).
- Top/bottom performer copy with metrics (feedback loop).
- Compliance rulesets per platform and per industry.

**Outputs**
- Copy assets, versioned, tagged by campaign/experiment, written to the creative library.
- Self-assessed compliance flags (anything flagged routes to approval).
- **Gating**: client-facing long-form content and anything in a regulated category goes to
  human review; ad variants within an approved campaign concept ship autonomously.

**Tools required**
- Memory read/write (creative library, brand profiles)
- Web fetch (source material, client site)
- Grammar/plagiarism check API
- CMS draft API (WordPress/Webflow — drafts only, publish is gated)
- `request_approval`

**Memory requirements**
- **Read**: brand voice profile (the single most load-bearing memory object — examples of approved copy, banned phrases, tone spectrum), performance-tagged creative history.
- **Write**: every asset with metadata; voice-profile updates when client feedback arrives.
- Embedding index over the creative library ("find our best-performing urgency hooks for SaaS clients").

**Decision-making process**
1. Parse brief → confirm it has audience, offer, angle, format, constraint fields; bounce
   incomplete briefs back to Strategist (structured rejection, not silent guessing).
2. Load brand profile + top 5 performance-relevant exemplars from the library.
3. Generate matrix of variants (Sonnet); flagship/long-form gets an Opus pass.
4. Self-critique pass against brand profile + compliance rules; revise.
5. Route by risk: ad variants → straight to Media Buyer; client-visible/long-form/regulated →
   approval queue.

---

## 6. CRM Automation Agent

Owns lifecycle communication and data hygiene for client *and* agency CRMs.

**Responsibilities**
- Lead routing and scoring as contacts enter client funnels.
- Build and run lifecycle email/SMS sequences (welcome, nurture, abandoned-cart, win-back).
- Segmentation: maintain dynamic segments from behavior and firmographics.
- CRM hygiene: dedupe, enrichment, field normalization, pipeline-stage accuracy.
- Trigger handoffs (hot lead → client's sales team notification within minutes).

**Inputs**
- Webhook events: form fills, email engagement, purchases, page views (via CDP/Zapier-style ingestion).
- Sequence briefs from Strategist; copy from Copywriting Agent.
- Enrichment data (Clearbit/Apollo APIs).
- Suppression lists, consent records, regional regulations config (GDPR/CAN-SPAM/TCPA).

**Outputs**
- Executed sends (through ESP — SendGrid/Klaviyo/HubSpot APIs).
- Lead scores and segment memberships written back to CRM.
- Hot-lead alerts to client sales teams (Slack/email).
- Deliverability and engagement metrics → Reporting Agent.

**Tools required**
- ESP APIs (send, sequence management), SMS API (Twilio)
- CRM APIs (HubSpot/Salesforce/Attio), CDP/event ingestion
- Enrichment APIs
- Consent/suppression service (code-enforced — the agent cannot bypass it)

**Memory requirements**
- **Read**: sequence library, per-contact interaction history, segment definitions, regulatory config per client/region.
- **Write**: contact timeline events, score changes with reasons, sequence performance.
- Mostly *transactional* memory (CRM is the store of record); the agent's own memory holds playbooks and sequence templates.

**Decision-making process**
1. Event-driven: each inbound event hits a Haiku classification pass (intent, score delta, segment changes) — cheap and fast at volume.
2. Deterministic rules handle the 90% case (scoring matrices, segment SQL); the LLM handles
   the ambiguous 10% (free-text form answers, reply classification, sequence branching).
3. New sequence creation = Sonnet drafting → compliance check → human approval for the
   sequence *template*; individual sends within an approved template are autonomous.
4. Hard rule: no send to any contact without verified consent flag; suppression check is in
   code, before the API call, always.

---

## 7. Reporting Agent

Truth and measurement. Deliberately separated from the agents whose work it measures.

**Responsibilities**
- ETL: pull data from ad platforms, analytics, CRM, ESP into the warehouse daily.
- Metric computation: CPA, ROAS, LTV:CAC, pipeline velocity, experiment significance.
- Anomaly detection: spend, conversion, deliverability, tracking breakage.
- Produce dashboards (live) and narrative reports (weekly client-facing, daily internal).
- Evaluate experiments against pre-registered success criteria; declare winners/losers.

**Inputs**
- Raw platform data (all marketing/CRM/analytics APIs, read-only credentials).
- Experiment registry (from Strategist), KPI targets (from CEO Agent).
- Attribution model config per client.

**Outputs**
- Daily internal KPI digest → CEO Agent (this drives the CEO planning cycle).
- Weekly client report drafts → Customer Success Agent (human-approved before client sees it... initially).
- Experiment verdicts → Strategist + experiment registry.
- Anomaly alerts → escalation path (severity-scored).

**Tools required**
- Warehouse (BigQuery/DuckDB) + dbt-style transform runner
- Read-only platform API credentials (deliberately cannot mutate campaigns)
- Code execution (statistics: significance tests, holdout analysis)
- Chart/report generation, dashboard publisher (or BI tool API)

**Memory requirements**
- **Read**: metric definitions ("qualified lead" differs per client — this lives in memory as the metrics contract), targets, attribution configs.
- **Write**: report archive, anomaly log, experiment verdicts.
- The warehouse, not the LLM context, is the memory — the agent writes SQL, not recollections.

**Decision-making process**
1. Nightly batch (Batches API, 50% cost): ETL → transform → metric computation → narrative
   generation per client.
2. Numbers come from SQL, never from the LLM. The LLM narrates and interprets computed
   values; a post-generation validator cross-checks every number in the narrative against
   the warehouse before the report can leave the agent.
3. Anomaly scoring is statistical (code); the LLM writes the diagnosis and recommended action.
4. Experiment calls are mechanical against pre-registered criteria — the agent cannot move
   the goalposts after launch.

---

## 8. Customer Success Agent

Owns the client relationship after the sale: retention, expansion, satisfaction.

**Responsibilities**
- Client onboarding: kickoff materials, access collection, expectation setting.
- Proactive communication: weekly summaries, milestone celebrations, bad-news-early calls
  for underperformance (drafted for human delivery on high-stakes accounts).
- Health scoring: engagement, sentiment, performance-vs-promise, payment behavior.
- Churn-risk detection and save plays; renewal and upsell motions → Sales Agent.
- Intake: client requests/questions routed to the right agent as work orders.

**Inputs**
- Client emails/Slack messages (the client-facing inbox).
- Weekly reports from Reporting Agent; account health signals (KPIs, sentiment, invoices).
- Contract terms, renewal dates (memory).

**Outputs**
- All client-facing communication (tiered gating: routine sends autonomous after trust
  period; sensitive sends human-approved always).
- Client health scores → CEO Agent dashboard.
- Churn-risk escalations with recommended save play → human.
- Translated client requests → work orders via CEO Agent.

**Tools required**
- Email + Slack Connect APIs (client channels)
- CRM read/write, billing read (Stripe — payment health)
- Sentiment analysis over communication history
- `create_work_order_request`, `escalate_to_human`

**Memory requirements**
- **Read**: complete relationship history per client — every email, meeting note, complaint, compliment, promise made. Promises are first-class memory objects with due dates.
- **Write**: interaction log, health-score history with contributing factors, promise tracker.
- This agent has the strictest memory-faithfulness requirement: contradicting something
  told to the client three weeks ago is a fireable offense for a human AM, and same here.

**Decision-making process**
1. Inbound client message → urgency/sentiment classification (Haiku) → full Opus pass for response drafting with relationship history loaded.
2. Response risk tiers: factual/routine → send (post-trust-period); anything touching
   money, performance disappointment, scope, or contract → human approval with drafted
   response and context packet.
3. Health score recomputed on every significant event; crossing a threshold downward fires
   a churn-risk play proposal to the human within the hour.
4. Never argues with a client. Disagreement or pushback → human, always.
