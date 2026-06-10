# Repruv

**AI-native reputation management for multi-location local businesses.** A Reviewnizer competitor built to win on three axes: compliant review velocity (no gating, ever), Claude-powered response automation in the business's own voice, and voice-of-customer analytics across locations.

Built as a complete founder-level exercise: strategy, architecture, production code, deployment plan, roadmap, and risk register.

## Documents

| Doc | Contents |
|---|---|
| [docs/01-strategy.md](docs/01-strategy.md) | Market critique of Reviewnizer, ICP selection, vision & USP, pricing, GTM to $100K MRR, key decisions |
| [docs/02-architecture.md](docs/02-architecture.md) | System architecture, frontend/backend design, DB schema, API spec, AI engine design, deployment plan |
| [docs/03-roadmap-90-days.md](docs/03-roadmap-90-days.md) | Week-by-week engineering + GTM plan with phase gates |
| [docs/04-risks.md](docs/04-risks.md) | Top 10 risks, scored, with mitigations |

## Codebase (Next.js 15 + Postgres)

```
src/
  db/schema.ts            Multi-tenant schema: orgs → locations → contacts/reviews/requests
  lib/
    auth.ts               better-auth + organizations plugin
    tenant.ts             Org-context guard — every API route resolves tenancy here
    ai/analyze.ts         Claude review analysis (sentiment, topics, safety flags) — structured outputs
    ai/respond.ts         Claude response drafting + auto-publish policy engine
    requests.ts           Review-request sequence engine (state machine, quiet hours, consent)
    sms.ts                Twilio send + signature verification + STOP handling
    email.ts              Resend transactional email
    stripe.ts             Per-location quantity billing
  app/
    r/[code]/             Public dual-CTA page (public review + private feedback — the no-gating core)
    dashboard/            Overview dashboard (RSC)
    api/
      webhooks/stripe     Subscription sync (signature-verified, idempotent)
      webhooks/twilio     Inbound SMS + delivery status (TCPA STOP handling)
      cron/               Scheduler ticks: send due requests, analyze new reviews
      reviews/[id]/respond  AI draft generation endpoint
```

## Run it

```bash
cp .env.example .env   # fill in Postgres, Anthropic, Twilio, Resend, Stripe keys
npm install
npm run db:migrate     # apply drizzle/ migrations
npm run dev
```

`npm run typecheck` and `npm run build` are clean. Cron schedules are in `vercel.json`; protect them with `CRON_SECRET`.

## The one non-negotiable

Every review request links every recipient to the same page with **both** a public-review CTA and a private-feedback channel. There is no code path that filters "unhappy" customers away from the public option — that's review gating, it violates Google's policies and the FTC rule on reviews, and it is the incumbents' biggest liability. Compliance is the moat.
