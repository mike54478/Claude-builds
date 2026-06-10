"""Shared memory layer (L1 records + L2 versioned documents).

MVP: in-memory dicts behind the same API the Postgres implementation will
expose. The two invariants that matter are enforced here from day one:

1. Client scoping — an agent run scoped to client A cannot read client B.
2. Versioned, append-only documents with provenance on every write.

L3 (pgvector semantic index) and L4 (warehouse) arrive in Phase 1/2.
See docs/system-design.md §2.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field

SHARED_SCOPE = "_agency"  # cross-client assets: playbooks, rate card, config


class DocumentVersion(BaseModel):
    version: int
    content: dict[str, Any]
    rationale: str
    written_by: str
    run_id: str
    written_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Promise(BaseModel):
    """Promises to clients are first-class memory, not prose."""

    id: str = Field(default_factory=lambda: f"prm_{uuid.uuid4().hex[:10]}")
    client_id: str
    promised_to: str
    what: str
    due: Optional[datetime] = None
    status: str = "open"  # open | kept | broken | superseded


class Decision(BaseModel):
    """Every consequential agent decision, with rationale — the audit trail
    that doubles as the playbook-refinement training set."""

    id: str = Field(default_factory=lambda: f"dec_{uuid.uuid4().hex[:10]}")
    client_id: str
    decided_by: str
    decision: str
    rationale: str
    alternatives_rejected: list[str] = Field(default_factory=list)
    decided_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScopedMemory:
    """A view of memory restricted to one client (plus shared assets)."""

    def __init__(self, store: "MemoryStore", client_id: str, agent: str, run_id: str):
        self._store = store
        self.client_id = client_id
        self.agent = agent
        self.run_id = run_id

    def _check(self, client_id: str) -> None:
        if client_id not in (self.client_id, SHARED_SCOPE):
            raise PermissionError(
                f"run scoped to {self.client_id!r} attempted access to {client_id!r}"
            )

    def read_document(self, client_id: str, key: str) -> Optional[DocumentVersion]:
        self._check(client_id)
        versions = self._store._documents.get((client_id, key), [])
        return versions[-1] if versions else None

    def write_document(self, client_id: str, key: str, content: dict, rationale: str) -> DocumentVersion:
        self._check(client_id)
        versions = self._store._documents.setdefault((client_id, key), [])
        doc = DocumentVersion(
            version=len(versions) + 1,
            content=content,
            rationale=rationale,
            written_by=self.agent,
            run_id=self.run_id,
        )
        versions.append(doc)
        return doc

    def record_decision(self, decision: str, rationale: str, alternatives: list[str] | None = None) -> Decision:
        rec = Decision(
            client_id=self.client_id,
            decided_by=self.agent,
            decision=decision,
            rationale=rationale,
            alternatives_rejected=alternatives or [],
        )
        self._store._decisions.append(rec)
        return rec

    def record_promise(self, promised_to: str, what: str, due: datetime | None = None) -> Promise:
        rec = Promise(client_id=self.client_id, promised_to=promised_to, what=what, due=due)
        self._store._promises.append(rec)
        return rec

    def open_promises(self) -> list[Promise]:
        return [
            p for p in self._store._promises
            if p.client_id == self.client_id and p.status == "open"
        ]


class MemoryStore:
    """Process-wide store; hand agents ScopedMemory views, never this object."""

    def __init__(self) -> None:
        self._documents: dict[tuple[str, str], list[DocumentVersion]] = {}
        self._decisions: list[Decision] = []
        self._promises: list[Promise] = []

    def scope(self, client_id: str, agent: str, run_id: str) -> ScopedMemory:
        return ScopedMemory(self, client_id, agent, run_id)
