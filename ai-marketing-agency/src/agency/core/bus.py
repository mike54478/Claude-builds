"""Typed event bus + work-order lifecycle.

MVP transport is in-memory; the interface is designed so Phase 1 swaps in
Postgres-backed persistence and Phase 3 swaps in Redis Streams/SQS without
touching agent code. See docs/system-design.md §1.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class Priority(str, Enum):
    P0 = "p0"
    P1 = "p1"
    P2 = "p2"


class Envelope(BaseModel):
    """Every message on the bus, work order or broadcast event."""

    id: str = Field(default_factory=lambda: _new_id("evt"))
    type: str
    schema_version: int = 2
    sender: str
    recipient: Optional[str] = None  # None = broadcast
    client_id: Optional[str] = None
    correlation_id: Optional[str] = None
    priority: Priority = Priority.P1
    payload: dict[str, Any] = Field(default_factory=dict)
    requires_ack: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deadline: Optional[datetime] = None


class WorkOrderStatus(str, Enum):
    CREATED = "created"
    CLAIMED = "claimed"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    REVIEW = "review"
    COMPLETED = "completed"
    REJECTED = "rejected"
    ESCALATED = "escalated"


class WorkOrder(BaseModel):
    id: str = Field(default_factory=lambda: _new_id("wo"))
    client_id: str
    created_by: str
    assigned_to: str
    title: str
    # Orders without acceptance criteria are bounced before claim — this is
    # the rule that prevents inter-agent thrash (docs/system-design.md).
    acceptance_criteria: list[str]
    budget_usd: float = 0.0
    status: WorkOrderStatus = WorkOrderStatus.CREATED
    rejection_count: int = 0
    blocked_reason: Optional[str] = None
    context: dict[str, Any] = Field(default_factory=dict)
    deadline: Optional[datetime] = None

    MAX_REJECTIONS: int = 2


class Bus:
    """In-memory pub/sub + work-order store (MVP)."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[Callable[[Envelope], None]]] = defaultdict(list)
        self._log: list[Envelope] = []
        self._work_orders: dict[str, WorkOrder] = {}

    # --- events ---------------------------------------------------------

    def subscribe(self, topic_prefix: str, handler: Callable[[Envelope], None]) -> None:
        self._subscribers[topic_prefix].append(handler)

    def publish(self, env: Envelope) -> None:
        self._log.append(env)
        for prefix, handlers in self._subscribers.items():
            if env.type.startswith(prefix):
                for handler in handlers:
                    handler(env)

    @property
    def log(self) -> list[Envelope]:
        return list(self._log)

    # --- work orders ------------------------------------------------------

    def create_work_order(self, order: WorkOrder) -> WorkOrder:
        if not order.acceptance_criteria:
            raise ValueError(f"work order {order.id!r} has no acceptance criteria")
        self._work_orders[order.id] = order
        self.publish(
            Envelope(
                type="work_order.created",
                sender=order.created_by,
                recipient=order.assigned_to,
                client_id=order.client_id,
                correlation_id=order.id,
                payload=order.model_dump(mode="json"),
            )
        )
        return order

    def claim(self, order_id: str, agent: str) -> WorkOrder:
        order = self._work_orders[order_id]
        if order.assigned_to != agent:
            raise PermissionError(f"{agent} cannot claim order assigned to {order.assigned_to}")
        order.status = WorkOrderStatus.CLAIMED
        return order

    def transition(self, order_id: str, status: WorkOrderStatus, reason: str | None = None) -> WorkOrder:
        order = self._work_orders[order_id]
        if status == WorkOrderStatus.REJECTED:
            order.rejection_count += 1
            if order.rejection_count > order.MAX_REJECTIONS:
                status = WorkOrderStatus.ESCALATED  # ping-pong cap
        order.status = status
        order.blocked_reason = reason if status == WorkOrderStatus.BLOCKED else None
        self.publish(
            Envelope(
                type=f"work_order.{status.value}",
                sender="bus",
                client_id=order.client_id,
                correlation_id=order.id,
                payload={"reason": reason} if reason else {},
            )
        )
        return order

    def pending_for(self, agent: str) -> list[WorkOrder]:
        return [
            o for o in self._work_orders.values()
            if o.assigned_to == agent and o.status == WorkOrderStatus.CREATED
        ]
