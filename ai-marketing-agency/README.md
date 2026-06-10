# Autonomous AI Marketing Agency

A reference design + code scaffolding for a fully autonomous AI marketing agency that can
realistically replace the output of a 3–5 person boutique agency, built the way a
venture-backed AI startup would build it: an orchestrated fleet of specialized Claude-powered
agents with shared memory, an event bus, human approval gates, and hard spend controls.

## What's in this repo

| Path | Contents |
|---|---|
| `docs/agents.md` | Full specs for all 8 agents: responsibilities, inputs, outputs, tools, memory, decision process |
| `docs/system-design.md` | Inter-agent communication, shared memory system, approval workflows, escalation paths |
| `docs/architecture.md` | Technical architecture and 4-phase implementation plan |
| `docs/economics.md` | Operating cost model, bottleneck analysis, and the business case vs. a 3–5 person agency |
| `src/agency/` | Python scaffolding: base agent loop, message bus, memory layer, approval queue, escalation, agent registry, tool stubs |
| `agency.yaml` | Declarative agent/model/tool configuration |

## The fleet at a glance

```
                          ┌─────────────┐
                          │  CEO Agent  │  (orchestrator — Opus 4.8)
                          └──────┬──────┘
        ┌──────────┬─────────────┼─────────────┬───────────────┐
        ▼          ▼             ▼             ▼               ▼
   ┌────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐
   │ Sales  │ │Strategist│ │Media Buyer│ │Copywriter│ │Customer Succ.│
   └───┬────┘ └────┬─────┘ └─────┬─────┘ └────┬─────┘ └──────┬───────┘
       │           │             │            │              │
       └───────────┴──────┬──────┴─────┬──────┴──────────────┘
                          ▼            ▼
                  ┌──────────────┐ ┌───────────┐
                  │CRM Automation│ │ Reporting │
                  └──────────────┘ └───────────┘
            (all agents share: event bus · memory · approval queue)
```

## Quick start (scaffolding demo)

```bash
cd ai-marketing-agency
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python -m agency.main --demo   # runs a single CEO planning cycle against stub tools
```

The scaffolding runs end-to-end against **stub tool implementations** (no real ad spend,
no real emails). Wiring real platform APIs (Meta, Google Ads, HubSpot, SendGrid, Stripe)
is Phase 2 of the implementation plan — see `docs/architecture.md`.

## Design principles

1. **Money and messages are gated.** Any action that spends budget or contacts a human
   externally passes through the approval queue with tiered autonomy thresholds.
2. **One orchestrator, no peer-to-peer chaos.** Agents communicate via a typed event bus;
   the CEO agent owns goal decomposition and conflict resolution.
3. **Memory is the product.** Client context, brand voice, performance history, and
   playbooks live in a shared memory layer — agents are stateless workers over stateful memory.
4. **Right model for the job.** Opus 4.8 for judgment-heavy orchestration and strategy,
   Sonnet 4.6 for high-volume production work, Haiku 4.5 for routing/classification,
   Batches API for overnight reporting at 50% cost.
5. **Everything is auditable.** Every agent decision, tool call, approval, and escalation
   is an immutable event — the audit log *is* the system of record.
