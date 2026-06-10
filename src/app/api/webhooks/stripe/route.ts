import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, subscriptions, webhookEvents } from "@/db/schema";
import { stripe } from "@/lib/stripe";

function planFromPrice(priceId: string): "starter" | "pro" {
  return priceId === process.env.STRIPE_PRICE_PRO ? "pro" : "starter";
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency: first writer wins; replays are acknowledged and skipped.
  const inserted = await db
    .insert(webhookEvents)
    .values({ provider: "stripe", externalId: event.id, payload: null })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) return Response.json({ received: true, duplicate: true });

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (!orgId) break;

      const item = sub.items.data[0];
      const priceId = item?.price.id ?? "";
      const canceled = event.type === "customer.subscription.deleted";
      const periodEnd = item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null;

      await db
        .insert(subscriptions)
        .values({
          orgId,
          stripeSubscriptionId: sub.id,
          status: canceled ? "canceled" : sub.status,
          priceId,
          locationQuantity: item?.quantity ?? 1,
          currentPeriodEnd: periodEnd,
        })
        .onConflictDoUpdate({
          target: subscriptions.stripeSubscriptionId,
          set: {
            status: canceled ? "canceled" : sub.status,
            priceId,
            locationQuantity: item?.quantity ?? 1,
            currentPeriodEnd: periodEnd,
          },
        });

      await db
        .update(organization)
        .set({
          stripeCustomerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          plan: canceled ? "trial" : planFromPrice(priceId),
        })
        .where(eq(organization.id, orgId));
      break;
    }
    default:
      break;
  }

  return Response.json({ received: true });
}
