"""Shared agent runtime: context assembly -> Claude tool loop -> gated actions.

The manual agentic loop (rather than the SDK tool-runner) is deliberate:
approval gating must intercept between "model wants to act" and "action
happens". Tool calls route through the ToolGateway, which runs guardrails
and the autonomy matrix before any external API is touched.

Prompt-cache discipline (docs/architecture.md): the system prompt is frozen
per agent, the per-client core block carries its own cache breakpoint, and
volatile task content stays at the tail. No timestamps or run IDs may appear
in the cached prefix.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any

import anthropic

from agency.config import AgencyConfig
from agency.core.approvals import ActionProposal, RiskClass
from agency.core.memory import MemoryStore, ScopedMemory
from agency.tools.gateway import ToolGateway

MAX_LOOP_ITERATIONS = 20


@dataclass
class AgentSpec:
    name: str
    system_prompt: str          # frozen — part of the cached prefix
    tools: list[dict]           # frozen, deterministically ordered
    tool_risk: dict[str, RiskClass]


@dataclass
class RunResult:
    run_id: str
    agent: str
    client_id: str
    final_text: str
    actions_executed: list[str] = field(default_factory=list)
    actions_pending_approval: list[str] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)


class BaseAgent:
    def __init__(
        self,
        spec: AgentSpec,
        config: AgencyConfig,
        memory: MemoryStore,
        gateway: ToolGateway,
        client: anthropic.Anthropic | None = None,
    ):
        self.spec = spec
        self.config = config
        self.agent_config = config.agents[spec.name]
        self.model = config.resolve_model(spec.name)
        self.memory = memory
        self.gateway = gateway
        self.client = client or anthropic.Anthropic()

    # --- context assembly -------------------------------------------------

    def build_context(self, scoped: ScopedMemory, task: dict[str, Any]) -> list[dict]:
        """Context recipe: per-client core (cached) + volatile task tail.

        Subclasses override to pull recipe-specific documents; the ordering
        contract (stable first, volatile last) must be preserved.
        """
        client_core = scoped.read_document(scoped.client_id, "client_core")
        core_text = (
            json.dumps(client_core.content, sort_keys=True)  # deterministic bytes
            if client_core else "(no client core on file)"
        )
        return [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"<client_core>\n{core_text}\n</client_core>",
                        "cache_control": {"type": "ephemeral"},
                    },
                    {
                        "type": "text",
                        "text": f"<task>\n{json.dumps(task, sort_keys=True, default=str)}\n</task>",
                    },
                ],
            }
        ]

    # --- the loop -----------------------------------------------------------

    def run(self, client_id: str, task: dict[str, Any]) -> RunResult:
        run_id = f"run_{uuid.uuid4().hex[:10]}"
        scoped = self.memory.scope(client_id, self.spec.name, run_id)
        messages = self.build_context(scoped, task)
        result = RunResult(run_id=run_id, agent=self.spec.name, client_id=client_id, final_text="")

        for _ in range(MAX_LOOP_ITERATIONS):
            with self.client.messages.stream(
                model=self.model,
                max_tokens=self.agent_config.max_tokens,
                thinking={"type": "adaptive"},
                output_config={"effort": self.agent_config.effort},
                system=[
                    {
                        "type": "text",
                        "text": self.spec.system_prompt,
                        "cache_control": {"type": "ephemeral", "ttl": "1h"},
                    }
                ],
                tools=self.spec.tools,
                messages=messages,
            ) as stream:
                response = stream.get_final_message()

            result.usage["input_tokens"] = result.usage.get("input_tokens", 0) + response.usage.input_tokens
            result.usage["output_tokens"] = result.usage.get("output_tokens", 0) + response.usage.output_tokens

            if response.stop_reason == "refusal":
                result.final_text = "[refused — escalating per policy]"
                break

            if response.stop_reason != "tool_use":
                result.final_text = next(
                    (b.text for b in response.content if b.type == "text"), ""
                )
                break

            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                outcome = self._dispatch(scoped, block.name, block.input, result)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(outcome, default=str),
                        "is_error": bool(outcome.get("error")),
                    }
                )
            messages.append({"role": "user", "content": tool_results})

        return result

    # --- gated dispatch -----------------------------------------------------

    def _dispatch(
        self, scoped: ScopedMemory, tool: str, args: dict, result: RunResult
    ) -> dict:
        # Internal memory tools execute directly (R0).
        if tool == "record_decision":
            scoped.record_decision(args["decision"], args["rationale"], args.get("alternatives"))
            return {"ok": True}
        if tool == "write_document":
            doc = scoped.write_document(scoped.client_id, args["key"], args["content"], args["rationale"])
            return {"ok": True, "version": doc.version}

        # Everything external goes through the gateway: guardrails first,
        # then the autonomy matrix decides auto / ceo / human.
        proposal = ActionProposal(
            agent=self.spec.name,
            client_id=scoped.client_id,
            tool=tool,
            args=args,
            risk=self.spec.tool_risk.get(tool, RiskClass.R4),  # unknown tool -> max caution
            rationale=args.pop("_rationale", "") if isinstance(args, dict) else "",
            estimated_cost_usd=float(args.get("estimated_cost_usd", 0) or 0),
        )
        outcome = self.gateway.execute(proposal)
        if outcome.get("status") == "executed":
            result.actions_executed.append(proposal.id)
        elif outcome.get("status") == "pending_approval":
            result.actions_pending_approval.append(proposal.id)
        return outcome
