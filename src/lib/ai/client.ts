import Anthropic from "@anthropic-ai/sdk";

/**
 * Response quality IS the product, so we run our most capable model.
 * Inference cost per review (analysis + draft) is ~$0.02 — noise against
 * $99+/location/month. Override per-environment if needed.
 */
export const AI_MODEL = process.env.REPRUV_AI_MODEL ?? "claude-opus-4-8";

let _client: Anthropic | undefined;

export function anthropic(): Anthropic {
  _client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  return _client;
}
