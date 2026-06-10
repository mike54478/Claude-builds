import twilio from "twilio";

let _client: ReturnType<typeof twilio> | undefined;

function client() {
  _client ??= twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
  return _client;
}

export async function sendSms(input: {
  to: string;
  body: string;
  mediaUrls?: string[];
}): Promise<{ sid: string }> {
  const message = await client().messages.create({
    to: input.to,
    body: input.body,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    mediaUrl: input.mediaUrls,
    statusCallback: `${process.env.APP_URL}/api/webhooks/twilio`,
  });
  return { sid: message.sid };
}

/** Verify X-Twilio-Signature on inbound webhooks. */
export function verifyTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN ?? "",
    signature,
    url,
    params,
  );
}

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

export function isOptOutMessage(body: string): boolean {
  return STOP_WORDS.has(body.trim().toLowerCase());
}
