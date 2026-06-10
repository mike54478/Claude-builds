"""Tool gateway — the only path from agents to the outside world.

Order of operations for every external action:
  1. guardrails (deterministic; denial returns a structured reason)
  2. autonomy matrix (auto / ceo / human)
  3. adapter execution + audit record

Platform credentials live in adapters here, never in agent context.
Phase 0 ships stub adapters; Phase 1 swaps in Meta/Google/HubSpot/etc.
"""

from __future__ import annotations

from typing import Any, Callable

from agency.core.approvals import (
    ActionProposal,
    ApprovalService,
    GuardrailDenied,
    GuardrailService,
)


class ToolGateway:
    def __init__(self, guardrails: GuardrailService, approvals: ApprovalService):
        self.guardrails = guardrails
        self.approvals = approvals
        self._adapters: dict[str, Callable[[dict], dict]] = {}
        self.audit_log: list[dict] = []

    def register(self, tool: str, adapter: Callable[[dict], dict]) -> None:
        self._adapters[tool] = adapter

    def execute(self, proposal: ActionProposal) -> dict[str, Any]:
        try:
            self.guardrails.check(proposal)
        except GuardrailDenied as denial:
            self._audit(proposal, "guardrail_denied", str(denial))
            return {"status": "denied", "error": str(denial)}

        approver = self.approvals.route(proposal)
        if approver != "auto":
            ticket = self.approvals.enqueue(proposal, approver)
            self._audit(proposal, "pending_approval", approver)
            return {
                "status": "pending_approval",
                "ticket_id": ticket.id,
                "approver": approver,
                "note": "action queued; do not retry — continue with other work",
            }

        return self.execute_approved(proposal)

    def execute_approved(self, proposal: ActionProposal) -> dict[str, Any]:
        """Called directly for auto-tier actions, and by the approval service
        once a ceo/human ticket is approved."""
        adapter = self._adapters.get(proposal.tool)
        if adapter is None:
            self._audit(proposal, "error", "no adapter registered")
            return {"status": "error", "error": f"no adapter for tool {proposal.tool!r}"}
        outcome = adapter(proposal.args)
        self.guardrails.record_execution(proposal)
        self._audit(proposal, "executed", "")
        return {"status": "executed", "result": outcome}

    def _audit(self, proposal: ActionProposal, disposition: str, detail: str) -> None:
        self.audit_log.append(
            {
                "proposal_id": proposal.id,
                "agent": proposal.agent,
                "client_id": proposal.client_id,
                "tool": proposal.tool,
                "risk": proposal.risk.value,
                "disposition": disposition,
                "detail": detail,
            }
        )


def register_stub_adapters(gateway: ToolGateway) -> None:
    """Phase 0: every external tool returns a plausible stub so the full
    loop (proposal -> guardrail -> approval -> execution -> audit) runs
    end-to-end with no real spend or sends."""

    def stub(name: str) -> Callable[[dict], dict]:
        def _run(args: dict) -> dict:
            return {"stub": name, "echo": args}
        return _run

    for tool in [
        "ads.create_campaign", "ads.update_budget", "ads.pause_campaign",
        "crm.update_contact", "crm.move_stage",
        "comms.send_email", "comms.send_slack",
        "analytics.query", "billing.read_invoices",
        "calendar.book_meeting", "docs.generate_proposal",
    ]:
        gateway.register(tool, stub(tool))
