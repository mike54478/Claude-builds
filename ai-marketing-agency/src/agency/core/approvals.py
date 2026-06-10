"""Guardrails + approval queue.

Two distinct layers, deliberately separated (docs/system-design.md §3):

- Guardrails are deterministic code in front of every external action. The
  LLM cannot talk its way past them.
- The approval queue governs judgment: risk class x trust tier -> approver.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from agency.config import AgencyConfig


class RiskClass(str, Enum):
    R0 = "R0"  # internal: memory writes, drafts
    R1 = "R1"  # reversible external
    R2 = "R2"  # money, bounded
    R3 = "R3"  # money, structural
    R4 = "R4"  # irreversible / relationship / legal — human, always


class ActionProposal(BaseModel):
    id: str = Field(default_factory=lambda: f"act_{uuid.uuid4().hex[:10]}")
    agent: str
    client_id: str
    tool: str
    args: dict[str, Any]
    risk: RiskClass
    rationale: str
    evidence: list[str] = Field(default_factory=list)
    estimated_cost_usd: float = 0.0
    reversible: bool = True


class ApprovalTicket(BaseModel):
    id: str = Field(default_factory=lambda: f"apr_{uuid.uuid4().hex[:10]}")
    proposal: ActionProposal
    approver: str  # "ceo" | "human"
    status: str = "pending"  # pending | approved | rejected | expired
    decided_by: Optional[str] = None
    decision_note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GuardrailDenied(Exception):
    """Structured denial — returned to the agent so it can revise or escalate."""


class GuardrailService:
    """Hard, deterministic limits. Checked before every external call."""

    def __init__(self, config: AgencyConfig):
        self.config = config
        self._daily_spend: dict[str, float] = {}
        self._hourly_mutations: dict[str, int] = {}

    def check(self, proposal: ActionProposal) -> None:
        g = self.config.guardrails

        if proposal.tool.startswith("ads."):
            spend = self._daily_spend.get(proposal.client_id, 0.0) + proposal.estimated_cost_usd
            if spend > g.max_daily_spend_per_client_usd:
                raise GuardrailDenied(
                    f"daily spend cap: {spend:.0f} > {g.max_daily_spend_per_client_usd:.0f} USD"
                )
            pct = proposal.args.get("budget_change_pct", 0)
            if abs(pct) > g.max_single_budget_change_pct:
                raise GuardrailDenied(
                    f"budget change {pct}% exceeds cap {g.max_single_budget_change_pct}%"
                )
            mutations = self._hourly_mutations.get(proposal.client_id, 0) + 1
            if mutations > g.max_platform_mutations_per_account_per_hour:
                raise GuardrailDenied("platform mutation rate cap reached for this account")

        if proposal.tool.startswith("comms.send") and g.consent_required_for_sends:
            if not proposal.args.get("consent_verified", False):
                raise GuardrailDenied("send blocked: recipient consent not verified")

    def record_execution(self, proposal: ActionProposal) -> None:
        self._daily_spend[proposal.client_id] = (
            self._daily_spend.get(proposal.client_id, 0.0) + proposal.estimated_cost_usd
        )
        if proposal.tool.startswith("ads."):
            self._hourly_mutations[proposal.client_id] = (
                self._hourly_mutations.get(proposal.client_id, 0) + 1
            )


class ApprovalService:
    def __init__(self, config: AgencyConfig):
        self.config = config
        self.queue: list[ApprovalTicket] = []
        # trust tier per (client, agent); promotion/demotion driven by
        # approval-rate history in Phase 2 — manual for now.
        self._tiers: dict[tuple[str, str], str] = {}

    def tier_for(self, client_id: str, agent: str) -> str:
        return self._tiers.get((client_id, agent), "tier0")

    def set_tier(self, client_id: str, agent: str, tier: str) -> None:
        self._tiers[(client_id, agent)] = tier

    def route(self, proposal: ActionProposal) -> str:
        """Return the approver for this proposal: 'auto' | 'ceo' | 'human'."""
        tier = self.tier_for(proposal.client_id, proposal.agent)
        return self.config.autonomy[tier][proposal.risk.value]

    def enqueue(self, proposal: ActionProposal, approver: str) -> ApprovalTicket:
        ticket = ApprovalTicket(proposal=proposal, approver=approver)
        self.queue.append(ticket)
        return ticket

    def decide(self, ticket_id: str, approved: bool, by: str, note: str = "") -> ApprovalTicket:
        ticket = next(t for t in self.queue if t.id == ticket_id)
        ticket.status = "approved" if approved else "rejected"
        ticket.decided_by = by
        ticket.decision_note = note  # rejection notes feed playbook refinement
        return ticket

    def pending(self, approver: str | None = None) -> list[ApprovalTicket]:
        return [
            t for t in self.queue
            if t.status == "pending" and (approver is None or t.approver == approver)
        ]
