import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewAnalyses, reviews } from "@/db/schema";
import type { ReviewFlag, TopicMention } from "@/db/schema";
import { AI_MODEL, anthropic } from "./client";

/**
 * Controlled topic vocabulary keeps cross-location benchmarking apples-to-
 * apples; the model may add free-form topics beyond it.
 */
export const TOPIC_VOCABULARY = [
  "wait_time",
  "staff_friendliness",
  "pricing_billing",
  "quality_of_work",
  "cleanliness",
  "scheduling",
  "communication",
  "pain_comfort",
  "punctuality",
  "follow_up",
] as const;

const AnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
  sentiment_score: z
    .number()
    .describe("Overall sentiment from -1 (hostile) to 1 (delighted)"),
  topics: z.array(
    z.object({
      topic: z
        .string()
        .describe(
          `Prefer one of: ${TOPIC_VOCABULARY.join(", ")}. Free-form snake_case otherwise.`,
        ),
      sentiment: z.enum(["positive", "negative", "neutral"]),
      quote: z.string().describe("Shortest verbatim quote supporting this topic"),
    }),
  ),
  staff_mentions: z
    .array(z.string())
    .describe("First names of staff members mentioned, verbatim"),
  summary: z.string().describe("One sentence, plain language, for a busy owner"),
  flags: z.array(
    z.enum([
      "legal_threat",
      "health_safety",
      "discrimination_claim",
      "review_extortion",
      "contains_pii",
      "suspected_fake",
    ]),
  ),
});

export type ReviewAnalysis = z.infer<typeof AnalysisSchema>;

const ANALYSIS_SYSTEM = `You analyze customer reviews of local service businesses (dental, med-spa, home services, auto).

Rules:
- Judge sentiment from the text, not the star rating; they can disagree (note it in the summary if so).
- Flag conservatively but reliably:
  - legal_threat: mentions lawyers, lawsuits, reporting to authorities/boards.
  - health_safety: alleges injury, infection, unsafe work, code violations.
  - discrimination_claim: alleges bias on a protected characteristic.
  - review_extortion: demands money/refund in exchange for changing the review.
  - contains_pii: includes phone numbers, addresses, health details, or full names of non-staff individuals.
  - suspected_fake: content strongly suggests the author was never a customer.
- staff_mentions: only people who appear to work at the business.
- Keep quotes verbatim and minimal.`;

/** Analyze a single review with Claude using strict structured output. */
export async function analyzeReviewText(input: {
  rating: number;
  body: string;
  authorName: string;
  vertical?: string;
}): Promise<ReviewAnalysis> {
  const response = await anthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Business vertical: ${input.vertical ?? "local service business"}
Star rating: ${input.rating}/5
Author: ${input.authorName}

Review:
"""
${input.body || "(no text — rating only)"}
"""`,
      },
    ],
    output_config: { format: zodOutputFormat(AnalysisSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Analysis parse failed");
  return parsed;
}

/** Analyze + persist; idempotent (one analysis row per review). */
export async function analyzeAndStoreReview(reviewId: string) {
  const review = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) });
  if (!review) throw new Error(`Review ${reviewId} not found`);

  const analysis = await analyzeReviewText({
    rating: review.rating,
    body: review.body,
    authorName: review.authorName,
  });

  await db
    .insert(reviewAnalyses)
    .values({
      reviewId: review.id,
      sentiment: analysis.sentiment,
      sentimentScore: analysis.sentiment_score,
      topics: analysis.topics as TopicMention[],
      staffMentions: analysis.staff_mentions,
      summary: analysis.summary,
      flags: analysis.flags as ReviewFlag[],
      model: AI_MODEL,
    })
    .onConflictDoNothing();

  return analysis;
}
