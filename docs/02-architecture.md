# Repruv — System Architecture

## 1. Overview

**Shape: modular monolith.** One Next.js 15 (App Router) application serving both the dashboard UI and the API, backed by Postgres, with asynchronous work (sequence sending, review polling, AI analysis) running through scheduled jobs and webhook handlers. Two engineers, 90 days, one deployable unit. The module boundaries below (`messaging`, `reviews`, `ai`, `billing`) are the future service seams — each communicates with the others only through the database and explicit function interfaces, never by reaching into another module's tables ad hoc.

```
                ┌────────────────────────────────────────────────┐
                │                 Vercel (Next.js 15)             │
                │  ┌──────────┐  ┌──────────────┐  ┌──────────┐  │
  Browser ─────►│  │ App UI   │  │ API routes   │  │ Cron jobs│  │
                │  │ (RSC)    │  │ /api/*       │  │ /api/cron│  │
                │  └──────────┘  └──────┬───────┘  └────┬─────┘  │
                └────────────────────────┼──────────────┼────────┘
                                         │              │
        Twilio ──(inbound SMS/status)────┤              │
        Stripe ──(billing webhooks)──────┤              │
        Review sources ──(poll/webhook)──┤              │
                                         ▼              ▼
                              ┌─────────────────────────────┐
                              │   Postgres (Neon)           │
                              │   + job/outbox tables       │
                              └──────────┬──────────────────┘
                                         │
                 ┌───────────────────────┼────────────────────────┐
                 ▼                       ▼                        ▼
          Twilio (SMS/MMS)        Resend (email)        Anthropic API
                                                     (claude-opus-4-8:
                                                      sentiment, topics,
                                                      response drafts)
```

**Multi-tenancy:** single database, `organization_id` on every tenant-scoped row, enforced in the data-access layer (every query helper takes an org context; no raw table access from route handlers). Organizations contain **locations**; users join orgs through **memberships** with roles (`owner`, `admin`, `manager`, `member`). Agencies are organizations with `type='agency'` and child orgs.

**Async work without a queue server (v1):** jobs are rows. `review_requests` carry a `status` + `next_action_at`; a Vercel cron route claims due rows with `FOR UPDATE SKIP LOCKED` semantics (via `UPDATE ... RETURNING`), processes them, and reschedules. Same pattern for review polling and AI analysis. This is deliberately boring; when volume demands it, the cron loop is replaced by Inngest/QStash without touching business logic.

## 2. Frontend architecture

- **Next.js App Router, React Server Components by default.** Dashboard pages are RSC reading through the data-access layer; client components only for interactivity (inbox composer, response editor, charts).
- **Route groups:** `(marketing)` — landing/pricing, static; `(app)` — authenticated dashboard under middleware-protected `/dashboard`.
- **Key screens:** Overview (rating trend, response-time SLA, request funnel) → Reviews inbox (filter by source/rating/status; AI draft inline, edit-approve-publish) → Conversations (two-way SMS) → Contacts (+CSV import) → Sequences (request templates/timing) → Analytics (VoC topics, location benchmarking) → Settings (locations, brand voice, auto-publish policy, billing, team).
- **Styling:** Tailwind v4. No component library dependency in v1; shadcn-style primitives copied in as needed.
- State: server-first. Mutations via route handlers + `revalidatePath`. No client global store.

## 3. Backend architecture

Modules under `src/lib/`:

| Module | Responsibility |
|---|---|
| `auth` | better-auth (email/password + Google OAuth), organization plugin, session → org context |
| `db` | Drizzle ORM schema + tenant-scoped query helpers |
| `ai` | Claude client; review analysis (structured outputs), response drafting, brand-voice profiles |
| `sms` | Twilio send, inbound webhook handling, opt-out (STOP) compliance, A2P 10DLC registration metadata |
| `email` | Resend transactional sends (review requests, digests, alerts) |
| `reviews` | Source connectors (Google first), ingestion/dedup, polling scheduler |
| `requests` | Review-request sequence engine (state machine below) |
| `billing` | Stripe: per-location quantity subscriptions, webhook sync, entitlements |

**Review-request state machine** (one row per contact per sequence):

```
queued → sms_sent → [reminder_due] → reminder_sent → completed
   │         │                                          ▲
   │         ├── clicked_review ────────────────────────┤
   │         ├── clicked_feedback → feedback_received ──┤
   │         └── replied_stop → opted_out
   └── invalid_phone → email_fallback → ...
```

Timing defaults: send within 2h of job completion (or immediately on manual trigger), one reminder at +72h if no click, hard stop after reminder. Quiet hours 8pm–9am local enforced at claim time.

## 4. Database schema (summary — authoritative version in `src/db/schema.ts`)

```
organizations(id, name, type[business|agency], parent_org_id?, stripe_customer_id, plan, created_at)
users / sessions / accounts / verifications        ← better-auth managed
memberships(id, user_id, org_id, role)
locations(id, org_id, name, tz, phone, google_place_id, review_link, brand_voice jsonb,
          auto_publish_policy jsonb, quiet_hours jsonb)
contacts(id, org_id, location_id, first_name, last_name?, phone?, email?, sms_consent_at,
         opted_out_at, external_ref?, UNIQUE(location_id, phone))
sequences(id, org_id, name, steps jsonb)            ← request templates + delays
review_requests(id, org_id, location_id, contact_id, sequence_id, status, channel,
                next_action_at, short_code, clicked_at, completed_at, timestamps)
conversations(id, org_id, location_id, contact_id, last_message_at)
messages(id, conversation_id, direction[in|out], channel[sms|email], body, media jsonb,
         provider_sid, status, created_at)
review_sources(id, location_id, provider[google|facebook|yelp], external_id, sync_cursor, status)
reviews(id, org_id, location_id, source_id, provider, external_review_id, author_name,
        rating, body, published_at, UNIQUE(source_id, external_review_id))
review_analyses(review_id PK→reviews, sentiment, sentiment_score, topics jsonb,
                staff_mentions jsonb, summary, flags jsonb, model, analyzed_at)
review_responses(id, review_id, draft, final_text?, status[draft|approved|published|rejected],
                 published_at, author_user_id?, auto_published bool)
private_feedback(id, org_id, location_id, contact_id?, rating, body, status, created_at)
subscriptions(id, org_id, stripe_subscription_id, status, price_id, location_quantity,
              current_period_end)
webhook_events(id, provider, external_id UNIQUE, payload jsonb, processed_at)  ← idempotency
```

Indexes on every FK + `(org_id, created_at)` on hot tables; `review_requests(status, next_action_at)` partial index for the scheduler.

## 5. API specification (v1 — route handlers, session or API-key auth, all tenant-scoped)

| Method & path | Purpose |
|---|---|
| `POST /api/auth/[...all]` | better-auth (signup/signin/oauth/org management) |
| `GET/POST /api/locations` · `PATCH /api/locations/:id` | Location CRUD, brand voice, policies |
| `GET/POST /api/contacts` · `POST /api/contacts/import` | Contacts + CSV import (consent fields required) |
| `POST /api/review-requests` | Enqueue request(s) `{contactId(s), locationId, sequenceId?}` → 202 |
| `GET /api/review-requests?status=` | Funnel listing |
| `GET /api/r/:code` | Public short-link: logs click, splits to review URL / feedback form |
| `POST /api/feedback` | Public private-feedback submission |
| `GET /api/reviews?locationId=&rating=&status=` | Inbox listing (joined with analysis + response) |
| `POST /api/reviews/:id/respond` | Generate/regenerate AI draft → `{draft, confidence}` |
| `POST /api/reviews/:id/respond/approve` | Approve/edit & publish (provider API or copy-mode) |
| `GET /api/analytics/overview?orgId=&from=&to=` | Ratings trend, response SLA, request funnel |
| `GET /api/analytics/topics` | VoC topic trends, per-location benchmark |
| `POST /api/billing/checkout` · `POST /api/billing/portal` | Stripe Checkout/Portal sessions |
| `POST /api/webhooks/stripe` | Subscription lifecycle sync (signature-verified, idempotent) |
| `POST /api/webhooks/twilio` | Inbound SMS (STOP/HELP, replies→conversations) + delivery status |
| `GET /api/cron/process-requests` | Scheduler tick: claim due review_requests, send, reschedule |
| `GET /api/cron/sync-reviews` | Poll review sources, ingest, enqueue analysis |
| `GET /api/cron/analyze-reviews` | Claim unanalyzed reviews → Claude → store analysis + auto-draft |

Errors: JSON problem shape `{error: {code, message}}`; 401/403 tenant enforcement at the data layer; webhooks idempotent via `webhook_events.external_id`.

## 6. AI engine design

- **Model:** `claude-opus-4-8` everywhere (analysis + generation). Cost at scale: a 50-location org producing 1,000 reviews/mo ≈ low tens of dollars of inference vs ≥$5K MRR — quality dominates.
- **Analysis** (`analyzeReview`): one call per review, **structured outputs** (`output_config.format` with a strict JSON schema): sentiment, score, topics from a controlled vocabulary + free-form, staff mentions, summary, and `flags` (legal_threat, health_safety, discrimination_claim, review_extortion, PII) that block auto-publish and trigger alerts.
- **Response drafting** (`draftResponse`): prompt assembled from a cached system prompt (platform rules: never admit fault in legal contexts, never confirm someone was a patient/customer in healthcare verticals, no incentives, ≤120 words…) + location brand-voice profile + the review + its analysis. Returns draft + self-assessed confidence + reason codes.
- **Auto-publish policy** (per location): `rating ≥ minRating AND confidence ≥ threshold AND flags = ∅ AND withinDailyCap` → publish; else queue for human. Default: auto for 5★ only, off for healthcare verticals until the org flips it.
- **Brand voice:** onboarding asks 4 questions and ingests 3 example responses the owner likes; stored as a structured profile (tone, formality, sign-off, banned phrases), not raw few-shot text, so it composes with platform rules.
- Prompt-caching: stable platform system prompt first with `cache_control`, volatile review content last.

## 7. Deployment plan

| Concern | Choice | Notes |
|---|---|---|
| App hosting | **Vercel** | Zero-ops, preview deploys per PR, cron built in |
| Database | **Neon Postgres** | Serverless, branching for preview envs; daily PITR |
| Queue (v1→v2) | Vercel Cron → **Inngest** | Swap when sends >10K/day or per-job retries needed |
| SMS | Twilio + registered **A2P 10DLC** brand/campaign per customer vertical | Registration is week-1 work; throughput depends on it |
| Email | Resend (dedicated domain, DMARC) | |
| Billing | Stripe Billing, per-location `quantity` on one subscription item | |
| AI | Anthropic API | Keys server-side only; usage logged per org for COGS tracking |
| Observability | Sentry + Axiom (structured logs) + Stripe/Twilio dashboards | Alert: cron failures, webhook signature failures, AI flag spikes |
| Environments | `production`, `preview` (Neon branch per PR), `.env.example` documented | |
| Security | Secrets in Vercel env; webhook signature verification (Stripe + Twilio); rate limiting on public routes; tenant isolation tests in CI | |

CI: GitHub Actions — typecheck, lint, unit tests (state machine, policy engine, webhook idempotency), drizzle migration check. `main` → production; PR → preview.
