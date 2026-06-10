"""Load agency.yaml into typed config objects."""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel

CONFIG_PATH = Path(__file__).resolve().parents[2] / "agency.yaml"


class AgentConfig(BaseModel):
    model: str
    effort: str = "high"
    max_tokens: int = 16000


class Guardrails(BaseModel):
    max_daily_spend_per_client_usd: float
    max_single_budget_change_pct: float
    max_platform_mutations_per_account_per_hour: int
    consent_required_for_sends: bool


class AgencyConfig(BaseModel):
    models: dict[str, str]
    defaults: dict
    agents: dict[str, AgentConfig]
    guardrails: Guardrails
    autonomy: dict[str, dict[str, str]]
    escalation: dict

    def resolve_model(self, agent_name: str) -> str:
        """Map an agent's model alias (e.g. 'orchestration') to a model ID."""
        alias = self.agents[agent_name].model
        return self.models.get(alias, alias)


def load_config(path: Path = CONFIG_PATH) -> AgencyConfig:
    raw = yaml.safe_load(path.read_text())
    defaults = raw.get("defaults", {})
    agents = {
        name: AgentConfig(**{**defaults, **(spec or {})})
        for name, spec in raw["agents"].items()
    }
    return AgencyConfig(
        models=raw["models"],
        defaults=defaults,
        agents=agents,
        guardrails=Guardrails(**raw["guardrails"]),
        autonomy=raw["autonomy"],
        escalation=raw["escalation"],
    )
