# MVP Spec and Product Roadmap

## Build philosophy

One founder, three weeks, conservative scope. The MVP's job is to **never embarrass the owner on a
live call** while proving "we book jobs you were losing." Everything that can be manual at 5
customers stays manual (setup, QA, reporting) — we automate when it hurts.

**Build vs. buy for the voice pipeline:** start on a managed voice-agent platform (Vapi or Retell:
telephony + streaming STT + LLM orchestration + TTS with sub-second latency, ~$0.10–0.15/min all-in).
This trades ~$0.05/min of margin for 4–6 weeks of time-to-market — the right trade at our scale.
Migrate to a self-built pipeline (Twilio Media Streams + Deepgram + Claude + Cartesia) around month
4–5 when minute volume makes the margin worth the engineering week. The call-flow logic, FSM
integrations, and dashboard are ours from day one — that's where the moat is, and it's portable.

## MVP scope (weeks 3–5)

### 1. Call handling (the product)
- **Zero-switching-cost install:** customer keeps their number; conditional call forwarding
  (busy/no-answer after ~20s → FirstRing's Twilio number). After-hours: time-based forwarding.
  We provide per-carrier setup codes and do it WITH them on the onboarding call.
- **Conversation flow (per-trade template, configured per customer):**
  1. Branded greeting: "Thanks for calling Smith Plumbing, this is their after-hours line — I can
     get you on the schedule. What's going on?"
  2. Intent triage: emergency / service request / reschedule-or-existing-job / vendor-spam.
  3. **Emergency path** (burst pipe, gas smell, no-heat in freezing temps, flooding): capture
     address + callback number FIRST, state the emergency dispatch fee if the customer has one
     configured, then **warm-transfer to the on-call tech** (rings their cell; if no answer, SMS
     blast to the escalation list + tell caller the tech will call within X minutes).
  4. **Service-request path:** capture name, phone, address, issue description, photos-by-text
     prompt, preferred time → **book into Housecall Pro / Jobber** against real availability
     windows → confirm slot verbally.
  5. **Guardrails:** never quotes firm prices (only configured ranges/dispatch fees), never gives
     DIY repair advice, gracefully takes a message when unsure, hands off on request ("I'd rather
     talk to a person" → transfer/callback promise honored).
- **Latency target:** <1s response gap. **Barge-in** (caller can interrupt) required.
- **Spam/robocall filter** so owners aren't woken by texts about telemarketers.

### 2. Integrations (the moat)
- **Housecall Pro + Jobber** booking APIs at launch (both have public APIs; SMB-heavy user bases).
  ServiceTitan in month 3 (heavier API, bigger shops).
- Fallback for non-FSM shops: booking into Google Calendar + structured email/SMS dispatch sheet.

### 3. The owner loop (the retention feature, built INTO the MVP)
- **Real-time SMS to owner after every call:** "📞 2:14am — Jane D., 410 Oak St, water heater
  leaking. BOOKED Thu 9–11am into Housecall Pro. Est. value $450. Recording: [link]"
- **Web dashboard (minimal):** call log with recordings + transcripts + outcomes; running monthly
  counter: **"Jobs booked: 11 · Estimated revenue saved: $4,950."** That number is why they never
  cancel.
- **Weekly ROI email** (automated from the same data).

### 4. Internal tooling
- Config-per-customer as structured data (services, service area zips, dispatch fees, on-call
  rotation, FSM credentials, escalation rules) — a YAML/admin-form per customer is fine at 10 logos.
- **Call QA queue:** every low-confidence or transferred call flagged for founder review within 24h;
  one-click prompt/flow fix. This human-in-the-loop QA is how a solo founder ships trustworthy AI.

### Explicitly OUT of MVP
Outbound calls, payments/deposits, multi-language (month 4), web chat, native mobile app, deep
analytics, self-serve signup (founder onboards everyone — it's a feature).

## Roadmap (months 1–6)

| Month | Product focus | Why now |
|---|---|---|
| **1** | Validation sprint artifacts: demo line ("call and try to break it"), mystery-shop tooling, landing page | Sales needs a demo before a product |
| **2** | MVP hardening with 5 design partners: emergency flows per trade, HCP+Jobber booking, owner SMS loop, QA queue | Live calls surface 90% of real edge cases |
| **3** | **ServiceTitan integration**; missed-call text-back (instant SMS to hang-ups); after-hours → 24/7 overflow mode; Stripe billing + plan metering | Unlocks Pro tier ($399) and bigger shops |
| **4** | **Spanish-language calls** (huge in our launch metros); voice/greeting customization; storm-surge mode (overflow during weather events — HVAC's biggest pain); self-serve onboarding v1 | ARPU + market expansion + scalability |
| **5** | Margin work: migrate voice pipeline in-house (~halves COGS/min); booking-rate optimization (A/B greetings/flows); **Jobber & Housecall Pro app-marketplace listings** | Margin + the distribution loop |
| **6** | Outbound recalls v1 (AI calls to revive unsold estimates — massive expansion revenue); review-request texts after completed jobs; referral program in-product; multi-location support | Expansion ARPU on the installed base; sets up months 7–12 |

**The month-6 fork:** outbound recall campaigns ("you have 200 open estimates from the last year —
FirstRing will call them") is the wedge from $280 ARPU to $600+, and the answer to "what's after
$10k MRR." Not before month 6 — inbound trust must come first.
