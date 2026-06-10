import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contacts,
  locations,
  reviewRequests,
  sequences,
} from "@/db/schema";
import type { QuietHours, SequenceStep } from "@/db/schema";
import { reviewRequestEmailHtml, sendEmail } from "./email";
import { sendSms } from "./sms";

/**
 * Compliance is structural: every template links to the SAME dual-CTA page
 * (public review + private feedback, side by side). There is no code path
 * that routes "happy" customers differently from "unhappy" ones — that
 * would be review gating (Google TOS + FTC 16 CFR 465 violation).
 */
export const DEFAULT_SEQUENCE: SequenceStep[] = [
  {
    channel: "sms",
    delayHours: 0,
    template:
      "Hi {{firstName}}, thanks for choosing {{businessName}}! Would you take 60 seconds to share how we did? {{link}}",
  },
  {
    channel: "sms",
    delayHours: 72,
    template:
      "Hi {{firstName}}, just a gentle nudge from {{businessName}} — we'd love your feedback if you have a minute: {{link}}",
  },
];

export function renderTemplate(
  template: string,
  vars: { firstName: string; businessName: string; link: string },
): string {
  return template
    .replaceAll("{{firstName}}", vars.firstName)
    .replaceAll("{{businessName}}", vars.businessName)
    .replaceAll("{{link}}", vars.link);
}

/** Is `now` inside the location's quiet hours, in its local timezone? */
export function inQuietHours(quiet: QuietHours, timezone: string, now = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const local = fmt.format(now); // "HH:mm"
  // Quiet window typically spans midnight (e.g. 21:00 → 09:00).
  if (quiet.start <= quiet.end) return local >= quiet.start && local < quiet.end;
  return local >= quiet.start || local < quiet.end;
}

/** Enqueue review requests for a batch of contacts. Returns created count. */
export async function enqueueReviewRequests(input: {
  orgId: string;
  locationId: string;
  contactIds: string[];
  sequenceId?: string;
}): Promise<number> {
  const eligible = await db.query.contacts.findMany({
    where: and(
      eq(contacts.orgId, input.orgId),
      eq(contacts.locationId, input.locationId),
      inArray(contacts.id, input.contactIds),
    ),
  });

  const rows = eligible
    // Consent + opt-out checks happen at enqueue AND again at send time.
    .filter((c) => !c.optedOutAt && (c.smsConsentAt || c.email))
    .map((c) => ({
      orgId: input.orgId,
      locationId: input.locationId,
      contactId: c.id,
      sequenceId: input.sequenceId ?? null,
      nextActionAt: new Date(),
    }));

  if (rows.length === 0) return 0;
  const inserted = await db.insert(reviewRequests).values(rows).returning({
    id: reviewRequests.id,
  });
  return inserted.length;
}

/**
 * Scheduler tick. Claims due rows with SKIP LOCKED (safe under concurrent
 * cron invocations), leases them 10 minutes ahead, processes each, then
 * advances or completes the state machine.
 */
export async function processDueRequests(limit = 50): Promise<{
  processed: number;
  sent: number;
}> {
  const claimed = (await db.execute(sql`
    UPDATE review_requests
    SET next_action_at = now() + interval '10 minutes'
    WHERE id IN (
      SELECT id FROM review_requests
      WHERE status IN ('queued', 'step_sent')
        AND next_action_at IS NOT NULL
        AND next_action_at <= now()
      ORDER BY next_action_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `)) as unknown as { id: string }[];

  let sent = 0;
  for (const { id } of claimed) {
    try {
      if (await processOneRequest(id)) sent++;
    } catch (err) {
      console.error(`review_request ${id} failed`, err);
      await db
        .update(reviewRequests)
        .set({ status: "failed", nextActionAt: null })
        .where(eq(reviewRequests.id, id));
    }
  }
  return { processed: claimed.length, sent };
}

async function processOneRequest(requestId: string): Promise<boolean> {
  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.id, requestId),
  });
  if (!request) return false;

  const [contact, location, sequence] = await Promise.all([
    db.query.contacts.findFirst({ where: eq(contacts.id, request.contactId) }),
    db.query.locations.findFirst({ where: eq(locations.id, request.locationId) }),
    request.sequenceId
      ? db.query.sequences.findFirst({ where: eq(sequences.id, request.sequenceId) })
      : Promise.resolve(undefined),
  ]);
  if (!contact || !location) return false;

  // Opt-out wins over everything, including mid-sequence.
  if (contact.optedOutAt) {
    await db
      .update(reviewRequests)
      .set({ status: "opted_out", nextActionAt: null })
      .where(eq(reviewRequests.id, requestId));
    return false;
  }

  const steps = sequence?.steps ?? DEFAULT_SEQUENCE;
  const step = steps[request.nextStep];

  // Sequence exhausted (or contact already converted) → complete.
  if (!step || request.clickedAt) {
    await db
      .update(reviewRequests)
      .set({
        status: "completed",
        completedAt: new Date(),
        nextActionAt: null,
      })
      .where(eq(reviewRequests.id, requestId));
    return false;
  }

  // Respect quiet hours: push to the next half hour and let the next tick retry.
  if (inQuietHours(location.quietHours, location.timezone)) {
    await db
      .update(reviewRequests)
      .set({ nextActionAt: new Date(Date.now() + 30 * 60 * 1000) })
      .where(eq(reviewRequests.id, requestId));
    return false;
  }

  const link = `${process.env.APP_URL}/r/${request.shortCode}`;
  const body = renderTemplate(step.template, {
    firstName: contact.firstName,
    businessName: location.name,
    link,
  });

  const canSms = step.channel === "sms" && contact.phone && contact.smsConsentAt;
  if (canSms) {
    await sendSms({ to: contact.phone!, body });
  } else if (contact.email) {
    await sendEmail({
      to: contact.email,
      subject: `How was your experience with ${location.name}?`,
      html: reviewRequestEmailHtml({
        firstName: contact.firstName,
        businessName: location.name,
        link,
      }),
    });
  } else {
    await db
      .update(reviewRequests)
      .set({ status: "failed", nextActionAt: null })
      .where(eq(reviewRequests.id, requestId));
    return false;
  }

  const nextStep = steps[request.nextStep + 1];
  await db
    .update(reviewRequests)
    .set({
      status: "step_sent",
      nextStep: request.nextStep + 1,
      nextActionAt: nextStep
        ? new Date(Date.now() + nextStep.delayHours * 3600 * 1000)
        : null,
      ...(nextStep ? {} : { completedAt: new Date() }),
    })
    .where(eq(reviewRequests.id, requestId));

  return true;
}
