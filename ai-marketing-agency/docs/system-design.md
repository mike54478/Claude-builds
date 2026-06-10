# System Design: Communication, Memory, Approvals, Escalation

## 1. Inter-agent communication

### Topology: hub-and-spoke with a typed event bus

Agents never call each other's LLMs directly. All coordination flows through two primitives:

1. **Work orders** (directed, durable tasks) — created by the CEO Agent (or by other agents
   *via* the CEO Agent), claimed by the target agent, with lifecycle states.
2. **Events** (broadcast, fire-and-forget facts) — "campaign X paused", "lead Y scored hot",
   "report Z published". Agents subscribe to the topics they care about.

Why not peer-to-peer agent conversations? Three reasons a startup learns the hard way:
- **Cost**: two Opus agents "discussing" burns tokens quadratically with no convergence guarantee.
- **Debuggability**: a typed work order with acceptance criteria is auditable; a 40-turn
  agent chat is not.
- **Authority**: budget and priority conflicts need a single resolver (CEO Agent), not negotiation.

### Message schema

Every message on the bus is a typed, versioned envelope:

```json
{
  "id": "evt_01H...",
  "type": "work_order.created | work_order.completed | event.metric_anomaly | ...",
  "schema_version": 2,
  "sender": "agent.strategist",
  "recipient": "agent.copywriter",        // null for broadcast events
  "client_id": "cl_acme",
  "correlation_id": "wo_8821",            // threads all messages of one workflow
  "priority": "p0 | p1 | p2",
  "payload": { "...typed per message type..." },
  "requires_ack": true,
  "created_at": "2026-06-10T14:00:00Z",
  "deadline": "2026-06-11T14:00:00Z"
}
```

### Work order lifecycle

```
created → claimed → in_progress → (blocked ⇄ in_progress) → review → completed
                                            │                  │
                                            └→ escalated       └→ rejected (back to in_progress, max 2 cycles)
```

- **Acceptance criteria are part of the order.** "Write ad copy" is invalid; "deliver 12
  variants in the 4×3 hook/angle matrix per brief BR-1142, compliant with Meta policy,
  by 18:00 UTC" is valid. The receiving agent validates the order before claiming it and
  bounces malformed orders back — this single rule eliminates most inter-agent thrash.
- **Blocked** requires a typed reason (missing input, needs approval, dependency) so the CEO
  Agent's planning cycle can unblock systematically.
- Two rejection cycles maximum, then auto-escalate — prevents infinite agent ping-pong.

### Transport (by phase)

- Phase 1 (MVP): Postgres tables + `LISTEN/NOTIFY` (or polling). One database, transactional
  with memory writes. Don't build Kafka on day one.
- Phase 3 (scale): Redis Streams or SQS per topic; outbox pattern from Postgres.

---

## 2. Shared memory system

### Four-layer design

| Layer | Store | Contents | Access pattern |
|---|---|---|---|
| **L1 — Records** | Postgres | Clients, contracts, budgets, contacts, campaigns, work orders, promises, experiment registry | Typed CRUD via memory API; source of truth |
| **L2 — Documents** | Postgres (JSONB) + object storage | Strategy docs, briefs, brand voice profiles, playbooks, reports — all versioned, append-only | Read-current / read-history / write-new-version |
| **L3 — Semantic index** | pgvector (same Postgres) | Embeddings over creative library, conversation history, playbooks, decisions log | "Find similar" retrieval at agent runtime |
| **L4 — Warehouse** | BigQuery / DuckDB | Metrics, platform data, event facts | SQL only; Reporting Agent owns writes |

A startup-pragmatic note: L1–L3 are *one Postgres instance* until well past 20 clients.
The layering is logical, not infrastructural.

### Memory access contract

Agents access memory only through a **memory service API**, never raw SQL (Reporting's
warehouse excepted). The API enforces:

- **Scoping**: an agent run is scoped to a `client_id`; cross-client reads are denied except
  for explicitly shared assets (anonymized playbooks, agency-level config). This prevents the
  catastrophic failure mode of leaking Client A's strategy into Client B's campaign.
- **Provenance**: every write records `(agent, run_id, work_order_id, timestamp)`. Every read
  in an LLM context is cited in agent output ("per brand profile v7").
- **Versioning**: documents are append-only. "Update the strategy" = write v8 with a diff
  rationale. Rollback is a pointer move.
- **Promises and decisions are first-class objects**, not prose: `{promised_to, what, due,
  status}` and `{decision, rationale, alternatives_rejected, decided_by}`. These two tables
  are what make the system trustworthy over months.

### Context assembly (what actually enters the prompt)

Each agent has a **context recipe** — a deterministic function from (agent, task type,
client) → prompt sections, ordered for prompt-cache stability:

```
[stable agency-wide system prompt]            ← cache breakpoint (1h TTL)
[client core: goals, brand profile, guardrails] ← cache breakpoint (per-client, 5m TTL)
[task-relevant memory: recipe-selected docs + semantic retrieval top-k]
[the work order + fresh data]                 ← volatile tail, never cached
```

Getting this ordering right is worth ~90% input-cost reduction on cached reads
(see `economics.md`). The rules from prompt-caching discipline apply: no timestamps or
UUIDs in the stable prefix, deterministic serialization, tools list frozen per agent.

### Memory hygiene

- Nightly compaction job (Haiku, batched): conversation logs older than 30 days →
  structured summaries; raw text retained in cold storage.
- Contradiction detection: when a new memory write conflicts with an existing record
  (client changed their target CPA), the write must reference and supersede the old record,
  emitting a `memory.superseded` event other agents can react to.
- PII handling: contact PII lives only in L1 with field-level access control; embeddings
  are computed over PII-redacted text.

---

## 3. Approval workflows

### The core idea: tiered autonomy with earned trust

Every action is classified by **risk class** and checked against the **autonomy matrix**.
The matrix is config (per client, per agent), not code — tightening a nervous new client to
"approve everything" is a YAML change.

| Risk class | Examples | Tier 0 (new client, <30d) | Tier 1 (established) | Tier 2 (high trust) |
|---|---|---|---|---|
| **R0 — Internal** | memory writes, drafts, analysis | autonomous | autonomous | autonomous |
| **R1 — Reversible external** | pause ad, segment change, CRM field update | CEO Agent approves | autonomous | autonomous |
| **R2 — Money, bounded** | budget shift ≤15%, bid changes, send within approved sequence | human approves | CEO Agent approves | autonomous |
| **R3 — Money, structural** | new campaign, budget shift >15%, new sequence template, proposal > $X | human approves | human approves | CEO Agent approves |
| **R4 — Irreversible / relationship / legal** | contract terms, pricing >10% discount, bad-news client comms, regulated-industry claims, anything PR-risky | human, always | human, always | human, always |

R4 never relaxes. That's the line that makes this system insurable and sellable.

### Approval queue mechanics

```
agent proposes action
   → guardrail service (code): hard caps, suppression lists, consent, spend ceilings
       → DENY: returns structured reason to agent (agent revises or escalates)
       → PASS: risk-classify → autonomy matrix lookup
           → autonomous: execute, log
           → CEO-tier: CEO Agent reviews (context packet + recommendation), approves/rejects with rationale
           → human-tier: approval ticket → operator UI / Slack with:
                 [what, why, evidence, cost, reversibility, agent's recommendation,
                  one-click approve / reject-with-note / edit-then-approve]
```

Design rules that matter:

- **Code before cognition.** Hard limits (spend ceilings, suppression lists, consent) are
  enforced by a deterministic guardrail service *in front of* every external API call. The
  LLM cannot talk its way past them. Approvals govern judgment; guardrails govern safety.
- **Approvals expire.** An unapproved R2 ticket auto-expires in 24h (action cancelled, agent
  notified); R3/R4 escalate to a reminder, then to the daily digest. Stale approvals
  executing days later cause incidents.
- **Batch ergonomics.** The operator UI groups tickets ("12 ad variants for Acme campaign
  X") for one-decision bulk approval — otherwise the human becomes the bottleneck (see
  `economics.md` § bottlenecks).
- **Every human decision is training data.** Reject reasons feed back into agent playbooks;
  a weekly job mines rejection patterns and proposes prompt/playbook updates.
- **Auto-promotion with evidence**: an agent moves Tier 0 → 1 → 2 per client per risk class
  based on approval-rate history (e.g., 95% approval over 50 consecutive R2 tickets →
  propose promotion to the operator; demotion is automatic on any serious incident).

---

## 4. Escalation paths

Escalation ≠ approval. Approvals are *expected* checkpoints; escalations are *exceptions* —
the agent is saying "this is outside my competence or authority, a different mind needs this."

### Severity ladder

| Sev | Definition | Route | SLA |
|---|---|---|---|
| **SEV-3** | Quality concern, low-confidence output, missing context | → CEO Agent | next planning cycle |
| **SEV-2** | Blocked work order, budget conflict, repeated rejection loop, experiment gone sideways | → CEO Agent, human in daily digest | 4h |
| **SEV-1** | Spend anomaly, deliverability collapse, angry client, platform account flag, KPI in freefall | → human immediately (Slack page) + CEO Agent | 30 min human ack |
| **SEV-0** | Active money hemorrhage, security/compliance incident, legal threat, client threatening to leave | → human page (phone/PagerDuty) + **automatic safe-state**: affected campaigns paused, sends halted for that client | 5 min ack |

### Escalation rules

1. **Escalate with a recommendation, not just a problem.** Every escalation packet contains:
   what happened, evidence, what the agent already tried, 2–3 options with the agent's
   recommendation and confidence. Humans adjudicate; they don't re-investigate from scratch.
2. **Automatic triggers** (code, not judgment): spend > 120% of daily pace → SEV-1;
   guardrail denial ×3 on same intent → SEV-2; client message sentiment below threshold →
   SEV-1; any platform policy/legal keyword in inbound → SEV-1 minimum.
3. **Uncertainty triggers** (judgment): agents are explicitly prompted to escalate when
   confidence is low on a consequential action — the system prompt frames escalation as
   *correct behavior*, never failure. An agent that never escalates is miscalibrated.
4. **No silent retries on external failures.** Two failed attempts at any external action →
   blocked + SEV-2. Retry storms against ad platforms get accounts banned.
5. **De-escalation is explicit**: a human closing a SEV-1/0 writes a disposition note that
   becomes memory (and often a new guardrail or playbook entry — incidents must compound
   into robustness).
6. **Dead-man's switch**: if the human operator hasn't interacted with the approval/escalation
   surface in 24h, the system tightens one autonomy tier globally and pauses all R3 actions —
   the agency degrades gracefully toward safety, never toward unsupervised spend.
