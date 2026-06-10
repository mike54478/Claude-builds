import Stripe from "stripe";

let _stripe: Stripe | undefined;

export function stripe(): Stripe {
  _stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
  return _stripe;
}

export const PLAN_PRICES = {
  starter: () => process.env.STRIPE_PRICE_STARTER!,
  pro: () => process.env.STRIPE_PRICE_PRO!,
} as const;

export type PaidPlan = keyof typeof PLAN_PRICES;

/**
 * One subscription per org; `quantity` = number of active locations.
 * Adding a location bumps quantity with proration — no new checkout.
 */
export async function createCheckoutSession(input: {
  orgId: string;
  customerEmail: string;
  stripeCustomerId?: string | null;
  plan: PaidPlan;
  locationQuantity: number;
}): Promise<{ url: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: input.stripeCustomerId ?? undefined,
    customer_email: input.stripeCustomerId ? undefined : input.customerEmail,
    line_items: [
      { price: PLAN_PRICES[input.plan](), quantity: input.locationQuantity },
    ],
    subscription_data: {
      trial_period_days: 14,
      metadata: { orgId: input.orgId },
    },
    metadata: { orgId: input.orgId, plan: input.plan },
    success_url: `${process.env.APP_URL}/dashboard?billing=success`,
    cancel_url: `${process.env.APP_URL}/dashboard?billing=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}

export async function createPortalSession(stripeCustomerId: string) {
  const session = await stripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.APP_URL}/dashboard`,
  });
  return { url: session.url };
}
