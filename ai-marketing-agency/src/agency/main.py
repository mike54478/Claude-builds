"""Phase-0 demo: wire the full stack and run one CEO planning cycle.

Usage:
    export ANTHROPIC_API_KEY=...
    python -m agency.main --demo

Stub adapters mean no real spend, sends, or platform mutations — but the
complete path (context recipe -> Claude tool loop -> guardrails -> autonomy
matrix -> approval queue -> audit log) runs for real.
"""

from __future__ import annotations

import argparse
import json

from agency.config import load_config
from agency.agents.registry import ALL_AGENTS
from agency.core.approvals import ApprovalService, GuardrailService
from agency.core.base_agent import BaseAgent
from agency.core.bus import Bus
from agency.core.escalation import EscalationService
from agency.core.memory import MemoryStore
from agency.tools.gateway import ToolGateway, register_stub_adapters


def build_stack():
    config = load_config()
    bus = Bus()
    memory = MemoryStore()
    guardrails = GuardrailService(config)
    approvals = ApprovalService(config)
    escalations = EscalationService(bus, config.escalation["dead_mans_switch_hours"])
    gateway = ToolGateway(guardrails, approvals)
    register_stub_adapters(gateway)
    agents = {
        name: BaseAgent(spec, config, memory, gateway)
        for name, spec in ALL_AGENTS.items()
    }
    return config, bus, memory, approvals, escalations, gateway, agents


def seed_demo_client(memory: MemoryStore) -> str:
    client_id = "cl_acme"
    scoped = memory.scope(client_id, "onboarding", "run_seed")
    scoped.write_document(
        client_id,
        "client_core",
        {
            "name": "Acme SaaS",
            "goal": "grow qualified pipeline 30% in Q3 at <= $180 CPA",
            "monthly_budget_usd": 25000,
            "channels": {"meta": 0.4, "google": 0.4, "linkedin": 0.2},
            "kpi_snapshot": {
                "qualified_leads_mtd": 41,
                "target_mtd": 55,
                "blended_cpa": 212,
                "spend_pacing": "94% of plan",
                "best_channel": "google_search_brand+nonbrand",
                "worst_channel": "linkedin (CPA $410)",
            },
        },
        rationale="demo seed",
    )
    return client_id


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="run one CEO planning cycle")
    args = parser.parse_args()
    if not args.demo:
        parser.print_help()
        return

    config, bus, memory, approvals, escalations, gateway, agents = build_stack()
    client_id = seed_demo_client(memory)

    print(f"== CEO planning cycle for {client_id} "
          f"(model: {config.resolve_model('ceo')}) ==\n")
    result = agents["ceo"].run(
        client_id,
        task={
            "type": "daily_planning_cycle",
            "instruction": (
                "Review the KPI snapshot against the client goal. Diagnose the gap, "
                "record your allocation decision, and issue the work orders and/or "
                "budget reallocations needed today."
            ),
        },
    )

    print(result.final_text)
    print(f"\n-- usage: {result.usage}")
    print(f"-- actions executed: {len(result.actions_executed)}")
    print(f"-- actions pending approval: {len(result.actions_pending_approval)}")

    if approvals.pending():
        print("\n== approval queue ==")
        for ticket in approvals.pending():
            p = ticket.proposal
            print(f"  [{ticket.id}] {p.risk.value} {p.tool} <- {p.agent}  approver={ticket.approver}")

    print("\n== audit log ==")
    for entry in gateway.audit_log:
        print(f"  {json.dumps(entry)}")


if __name__ == "__main__":
    main()
