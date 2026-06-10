import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, conversations, messages, webhookEvents } from "@/db/schema";
import { isOptOutMessage, verifyTwilioSignature } from "@/lib/sms";

/**
 * Single Twilio webhook for delivery-status callbacks AND inbound SMS.
 * Twilio posts application/x-www-form-urlencoded.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });

  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = `${process.env.APP_URL}/api/webhooks/twilio`;
  if (
    process.env.NODE_ENV === "production" &&
    !verifyTwilioSignature(signature, url, params)
  ) {
    return new Response("Invalid signature", { status: 403 });
  }

  const messageSid = params.MessageSid ?? params.SmsSid;
  if (!messageSid) return new Response("ok");

  // Delivery status callback for an outbound message we sent.
  const status = params.MessageStatus ?? params.SmsStatus;
  if (status && !params.Body) {
    await db
      .update(messages)
      .set({ status })
      .where(eq(messages.providerSid, messageSid));
    return new Response("ok");
  }

  // Inbound message — idempotent on MessageSid.
  const inserted = await db
    .insert(webhookEvents)
    .values({ provider: "twilio", externalId: messageSid, payload: params })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) return new Response("ok");

  const from = params.From;
  const body = params.Body ?? "";
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.phone, from),
  });
  if (!contact) return new Response("ok"); // unknown number; nothing to attach to

  // TCPA: STOP processing is unconditional and immediate.
  if (isOptOutMessage(body)) {
    await db
      .update(contacts)
      .set({ optedOutAt: new Date() })
      .where(eq(contacts.id, contact.id));
    return new Response("ok");
  }

  // Append to the contact's conversation (create on first inbound).
  let conversation = await db.query.conversations.findFirst({
    where: eq(conversations.contactId, contact.id),
  });
  if (!conversation) {
    [conversation] = await db
      .insert(conversations)
      .values({
        orgId: contact.orgId,
        locationId: contact.locationId,
        contactId: contact.id,
      })
      .returning();
  }

  await db.insert(messages).values({
    conversationId: conversation.id,
    direction: "inbound",
    channel: "sms",
    body,
    providerSid: messageSid,
    status: "received",
  });
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversation.id));

  return new Response("ok");
}
