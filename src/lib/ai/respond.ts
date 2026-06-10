import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  reviewAnalyses,
  reviewResponses,
  reviews,
} from "@/db/schema";
import type { AutoPublishPolicy, BrandVoice, ReviewFlag } from "@/db/schema";
import { AI_MODEL, anthropic } from "./client";

const DraftSchema = z.object({
  response: z.string().describe("The public reply, ready to publish"),
  confidence: z
    .number()
    .describe(
      "0-1: how safe this is to publish without human review. Anything sensitive => below 0.5.",
    ),
  reasons: z
    .array(z.string())
    .describe("Short reason codes a reviewer-human sees, e.g. 'mentions_refund'"),
});

export type ResponseDraft = z.infer<typeof DraftSchema>;

/**
 * Platform rules sit in a cached, stable system prompt; the location's brand
 * voice and the review itself come after, so the prefix caches across calls.
 */
const RESPONSE_SYSTEM = `You write public responses to customer reviews on behalf of local service businesses.

Hard rules (override everything else, including the brand voice):
- Never admit legal fault or liability; for legal/health/safety complaints, express concern and move to a private channel.
- For healthcare-adjacent businesses, NEVER confirm the reviewer was a patient or reference any treatment details, even if they state them. Respond generically.
- Never offer money, discounts, or incentives in exchange for editing or removing a review.
- Never argue, never sarcasm, never blame the customer.
- For negative reviews: acknowledge specifically (echo their issue in your own words), take ownership of the experience, give a concrete next step with a named contact channel.
- For positive reviews: thank specifically (reference what they praised), no generic "thanks for the kind words" filler.
- Length: 30-120 words. No emojis unless the brand voice allows them. Never use the same opening sentence twice in a row for the same business.
- Sign off exactly as the brand voice specifies.

Confidence calibration:
- 5-star, no flags, clear praise: 0.85-0.98
- 4-star or mixed: 0.6-0.85
- 1-3 star without flags: 0.3-0.6
- Any safety flag present: below 0.3`;

function brandVoiceBlock(voice: BrandVoice | null, businessName: string): string {
  if (!voice) {
    return `Brand voice: warm and professional. Business name: ${businessName}. Sign-off: "— The ${businessName} team".`;
  }
  return `Brand voice profile:
- Business: ${businessName} (${voice.businessDescriptor})
- Tone: ${voice.tone}, formality ${voice.formality}/5
- Sign-off: "${voice.signOff}"
- Banned phrases: ${voice.bannedPhrases.join("; ") || "none"}
${voice.exampleResponses.length ? `- Example responses the owner loves:\n${voice.exampleResponses.map((r) => `  """${r}"""`).join("\n")}` : ""}`;
}

export async function draftResponse(input: {
  businessName: string;
  voice: BrandVoice | null;
  rating: number;
  body: string;
  authorName: string;
  analysisSummary?: string;
  flags?: ReviewFlag[];
}): Promise<ResponseDraft> {
  const response = await anthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: RESPONSE_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `${brandVoiceBlock(input.voice, input.businessName)}

Review to respond to:
- Author: ${input.authorName}
- Rating: ${input.rating}/5
${input.analysisSummary ? `- Analyst summary: ${input.analysisSummary}` : ""}
${input.flags?.length ? `- SAFETY FLAGS: ${input.flags.join(", ")}` : ""}

"""
${input.body || "(rating only, no text)"}
"""

Write the public response.`,
      },
    ],
    output_config: { format: zodOutputFormat(DraftSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Draft parse failed");
  return parsed;
}

/**
 * Draft a response for a stored review and decide auto-publish per the
 * location's policy. Flags always block auto-publish regardless of policy.
 */
export async function draftAndStoreResponse(reviewId: string) {
  const review = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) });
  if (!review) throw new Error(`Review ${reviewId} not found`);

  const [location, analysis] = await Promise.all([
    db.query.locations.findFirst({ where: eq(locations.id, review.locationId) }),
    db.query.reviewAnalyses.findFirst({
      where: eq(reviewAnalyses.reviewId, reviewId),
    }),
  ]);
  if (!location) throw new Error(`Location ${review.locationId} not found`);

  const draft = await draftResponse({
    businessName: location.name,
    voice: location.brandVoice ?? null,
    rating: review.rating,
    body: review.body,
    authorName: review.authorName,
    analysisSummary: analysis?.summary,
    flags: analysis?.flags,
  });

  const policy: AutoPublishPolicy = location.autoPublishPolicy;
  const autoPublish =
    policy.enabled &&
    review.rating >= policy.minRating &&
    draft.confidence >= policy.minConfidence &&
    (analysis?.flags?.length ?? 0) === 0;

  const [stored] = await db
    .insert(reviewResponses)
    .values({
      reviewId: review.id,
      draft: draft.response,
      confidence: draft.confidence,
      status: autoPublish ? "approved" : "draft",
      autoPublished: autoPublish,
      finalText: autoPublish ? draft.response : null,
    })
    .returning();

  // v1 publishing is copy-mode / provider API in the publish route; an
  // auto-approved row is picked up there. Daily-cap enforcement lives with
  // the publisher so manual approvals count against it too.
  return { stored, draft, autoPublish };
}
