"""Escalation service: severity ladder, safe-state, dead-man's switch.

See docs/system-design.md §4. Escalations are exceptions, not checkpoints —
every escalation carries evidence and a recommendation, never just a problem.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from enum import IntEnum
from typing import Optional

from pydantic import BaseModel, Field

from agency.core.bus import Bus, Envelope, Priority


class Severity(IntEnum):
    SEV3 = 3  # quality concern -> CEO agent, next planning cycle
    SEV2 = 2  # blocked work / conflicts -> CEO agent + daily digest
    SEV1 = 1  # spend anomaly, angry client -> human immediately
    SEV0 = 0  # active hemorrhage / legal -> page + automatic safe-state


class Escalation(BaseModel):
    id: str = Field(default_factory=lambda: f"esc_{uuid.uuid4().hex[:10]}")
    severity: Severity
    raised_by: str
    client_id: str
    summary: str
    evidence: list[str] = Field(default_factory=list)
    attempted: list[str] = Field(default_factory=list)
    options: list[str] = Field(default_factory=list)
    recommendation: str = ""
    status: str = "open"  # open | acked | resolved
    disposition_note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EscalationService:
    def __init__(self, bus: Bus, dead_mans_switch_hours: int = 24):
        self.bus = bus
        self.open: list[Escalation] = []
        self._safe_state_clients: set[str] = set()
        self._last_human_interaction = datetime.now(timezone.utc)
        self._dead_mans_window = timedelta(hours=dead_mans_switch_hours)

    def raise_escalation(self, esc: Escalation) -> Escalation:
        self.open.append(esc)
        if esc.severity == Severity.SEV0:
            # Automatic safe-state: pause spend + halt sends for this client
            # before any human even looks at it.
            self.enter_safe_state(esc.client_id)
        self.bus.publish(
            Envelope(
                type=f"escalation.sev{esc.severity.value}",
                sender=esc.raised_by,
                client_id=esc.client_id,
                priority=Priority.P0 if esc.severity <= Severity.SEV1 else Priority.P1,
                payload=esc.model_dump(mode="json"),
                requires_ack=esc.severity <= Severity.SEV1,
            )
        )
        return esc

    def enter_safe_state(self, client_id: str) -> None:
        self._safe_state_clients.add(client_id)
        self.bus.publish(
            Envelope(
                type="safe_state.entered",
                sender="escalation_service",
                client_id=client_id,
                priority=Priority.P0,
                payload={"actions": ["pause_campaigns", "halt_sends"]},
            )
        )

    def in_safe_state(self, client_id: str) -> bool:
        return client_id in self._safe_state_clients

    def resolve(self, esc_id: str, disposition_note: str) -> Escalation:
        esc = next(e for e in self.open if e.id == esc_id)
        esc.status = "resolved"
        # Disposition notes become memory — incidents must compound into
        # new guardrails/playbooks, not just get closed.
        esc.disposition_note = disposition_note
        self.touch_human()
        return esc

    # --- dead-man's switch ------------------------------------------------

    def touch_human(self) -> None:
        self._last_human_interaction = datetime.now(timezone.utc)

    def dead_mans_switch_tripped(self) -> bool:
        """If the operator goes dark, the system degrades toward safety:
        callers tighten autonomy one tier and pause all R3 actions."""
        return datetime.now(timezone.utc) - self._last_human_interaction > self._dead_mans_window
