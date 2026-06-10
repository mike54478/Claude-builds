# Technical Architecture & Implementation Phases

## 1. Architecture overview

```
                                   ┌────────────────────────────────────────────┐
                                   │              OPERATOR SURFACE              │
                                   │  Next.js dashboard · Slack app · email     │
                                   │  (approvals, escalations, KPIs, overrides) │
                                   └───────────────▲────────────────────────────┘
                                                   │
┌─────────────────────────────────────────────────┼────────────────────────────────────┐
│ CONTROL PLANE                                   │                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────┴────────┐  ┌─────────────────────┐  │
│  │ Orchestrator │  │  Scheduler        │  │ Approval      │  │ Escalation          │  │
│  │ (work-order  │  │ (cron triggers:   │  │ Service       │  │ Service             │  │
│  │  state mach.)│  │  planning cycles, │  │ (autonomy     │  │ (sev routing,       │  │
│  │              │  │  opt. passes, ETL)│  │  matrix)      │  │  safe-state)        │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────▲────────┘  └─────────▲───────────┘  │
│         │                   │                   │                     │              │
│  ═══════╪═══════════════════╪═══ EVENT BUS ═════╪═════════════════════╪═══════════   │
│         │   (Postgres MVP → Redis Streams/SQS at scale; typed envelopes)             │
└─────────┼────────────────────────────────────────────────────────────────────────────┘
          │ claims work orders
┌─────────▼────────────────────────────────────────────────────────────────────────────┐
│ AGENT PLANE  (stateless workers; horizontal scale; one container image, 8 configs)    │
│                                                                                       │
│  ┌─────┐ ┌─────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌─────┐ ┌────────┐ ┌─────┐             │
│  │ CEO │ │Sales│ │Strategy│ │Media │ │ Copy │ │ CRM │ │Reporting│ │ CS  │             │
│  └──┬──┘ └──┬──┘ └───┬────┘ └──┬───┘ └──┬───┘ └──┬──┘ └───┬────┘ └──┬──┘             │
│     │  agent runtime: context recipe → Claude API (tool loop) → action proposals      │
│     └───────┴─────────┴─────────┴───────┴────────┴─────────┴────────┘                 │
│                          │                          │                                 │
│                 ┌────────▼─────────┐      ┌─────────▼──────────┐                      │
│                 │  GUARDRAIL SVC   │      │   TOOL GATEWAY     │                      │
│                 │ (deterministic:  │ ───▶ │ (adapters: Meta,   │                      │
│                 │  caps, consent,  │      │  Google, HubSpot,  │                      │
│                 │  suppression)    │      │  SendGrid, Stripe, │                      │
│                 └──────────────────┘      │  GA4, Slack …)     │                      │
│                                           └────────────────────┘                      │
└───────────────────────────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ DATA PLANE                                                                            │
│  Postgres (records L1 · documents L2 · pgvector L3 · bus MVP)                         │
│  Warehouse (DuckDB → BigQuery)  ·  Object storage (assets, report archive)            │
│  Immutable audit log (every prompt, response, tool call, approval, event)             │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Key architectural decisions

**Agents are stateless workers over stateful memory.** An "agent" is: a system prompt +
a context recipe + a tool allowlist + a model assignment + an autonomy config. The runtime
is one shared loop (see `src/agency/core/base_agent.py`). This means one container image,
trivial horizontal scaling, and adding a ninth agent is a config file.

**The tool gateway is the only path to the outside world.** Agents emit *action proposals*;
the gateway (a) runs guardrails, (b) checks the autonomy matrix, (c) executes via the
platform adapter, (d) writes the audit record. Platform credentials live in the gateway,
never in agent context — a prompt-injected agent can't exfiltrate what it never sees.

**LLM calls use the manual tool loop, not fire-and-forget.** The runtime uses the Claude
Messages API with a manual agentic loop precisely because approval gating must intercept
between "model wants to act" and "action happens" (this is the documented use case for
the manual loop over the SDK tool-runner).

**Model routing per agent** (config, not code):

| Route | Model | Settings |
|---|---|---|
| CEO / Strategist / Sales / CS | `claude-opus-4-8` | adaptive thinking, effort `high` |
| Media Buyer / Copywriter / CRM-sequences | `claude-sonnet-4-6` | adaptive thinking, effort `medium` |
| Classification / routing / compaction | `claude-haiku-4-5` | effort n/a, short max_tokens |
| Reporting nightly + memory compaction | `claude-sonnet-4-6` / `haiku` via **Batches API** | 50% price |

**Prompt-cache discipline is architectural.** Context recipes render: frozen agency prompt →
per-client core → task memory → volatile tail, with cache breakpoints at the stable
boundaries. Tool lists per agent are frozen and deterministically ordered. This is enforced
in the context assembler, not left to prompt authors.

**Observability from day one**: every run gets a trace (prompt hash, tokens in/out/cached,
cost, latency, tool calls, outcome). Cost per client per agent per day is a first-class
dashboard — token spend is COGS for this company.

**Security model**: per-client memory scoping in the memory API; least-privilege platform
credentials (Reporting gets read-only everywhere); all external content (client emails, web
research, webhook payloads) is wrapped as untrusted data in prompts; injection-style
instructions found in external content auto-escalate SEV-2.

---

## 2. Implementation phases

### Phase 0 — Foundations (weeks 1–3)
**Goal: the skeleton runs end-to-end with stub tools.**
- Postgres schema: clients, work orders, events, documents, decisions, promises, audit log.
- Agent runtime (base loop, context assembler, model router), event bus (Postgres), scheduler.
- Guardrail service with spend caps + the approval queue with a Slack approval flow.
- CEO + Reporting agents only, stub adapters, synthetic client data.
- **Exit criterion**: CEO runs a daily planning cycle from a synthetic KPI digest and emits
  work orders; every step visible in the audit log. *(This repo's scaffolding ≈ Phase 0.)*

### Phase 1 — One real client, copilot mode (weeks 4–8)
**Goal: real work, human approves everything (Tier 0 everywhere).**
- Strategist, Copywriter, Media Buyer agents live; real adapters: Meta Ads, Google Ads, GA4.
- Memory layers L1–L3 complete; brand-voice profile builder; experiment registry.
- Operator dashboard v1 (approvals, escalations, run traces).
- Run **one** design-partner client. Measure: approval rate per agent, human minutes/day,
  cost per client, output quality vs. the human baseline.
- **Exit criterion**: 4 consecutive weeks where the client's KPIs are flat-or-better vs.
  their prior agency baseline, with <60 human-minutes/day of oversight.

### Phase 2 — Full fleet, earned autonomy (weeks 9–16)
**Goal: all 8 agents, autonomy tiers active, 3–5 clients.**
- Sales, CRM, Customer Success agents live; adapters: HubSpot/Attio, SendGrid/Klaviyo,
  Twilio, Stripe, Calendly, DocuSign.
- Autonomy matrix + auto-promotion/demotion from approval history.
- Reporting moves to Batches API; nightly memory compaction; client-facing report pipeline.
- Escalation service with SEV ladder, safe-state automation, dead-man's switch.
- **Exit criterion**: 5 clients, ≥70% of R1/R2 actions autonomous, human time
  <30 min/client/day, gross margin per client >80%.

### Phase 3 — Scale and hardening (weeks 17–26)
**Goal: 15–25 clients per human operator.**
- Bus → Redis Streams/SQS; warehouse → BigQuery; multi-region sends.
- Playbook learning loop: rejection mining, prompt regression evals (golden-set CI for
  prompts — any prompt/playbook change runs the eval suite before deploy).
- Client self-serve portal (reports, request intake, approval delegation to the client for
  brand-sensitive creative).
- SOC 2 groundwork, per-client data export/deletion, model fallback chains
  (Opus → Sonnet on refusal/outage; queue-and-retry on rate limits).
- **Exit criterion**: 20 clients, 1 human operator, NRR > 100%, agent-caused SEV-1 rate
  < 1/month.

### What is deliberately *not* built early
- No fine-tuning (prompt + memory + playbooks compound faster and stay portable).
- No peer-to-peer agent chat protocols. No Kafka before 20 clients. No custom vector DB.
- No fully-autonomous client comms in months 1–4 regardless of how good it looks — trust
  tiering exists to be earned.
