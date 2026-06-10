# Market Validation

Validation is not a survey. It's evidence that (a) the pain exists at a price, (b) the buyer already
pays for inferior solutions, and (c) we can reach them repeatably. Here is what we know, what we
will verify in week 1–2, and the kill criteria that would make me stop.

## Evidence the market already exists

**1. The incumbent spend is the validation.**
- Human answering services targeting home services charge $250–$700+/mo (Ruby ~$245/mo for 50
  receptionist minutes; Smith.ai ~$290/mo for 30 calls; AnswerConnect similar). These businesses
  have existed profitably for decades selling *message-taking* — not even booking.
- Home-service franchises (Mr. Rooter, One Hour Heating) mandate 24/7 call answering for franchisees
  — the operators with the best data on call economics treat answered calls as non-negotiable.
- ServiceTitan, the category-king FSM software, built its own contact-center product — they see the
  call-handling pain across thousands of contractors and decided it was worth building into core.

**2. The missed-call problem is measurable and large.**
Directional numbers from industry studies (to be re-verified first-hand in week 1):
- Widely cited research puts unanswered calls to small businesses at ~60%+ of inbound volume.
- ~80% of callers who reach voicemail don't leave a message; in home services they call the next
  result on Google.
- 25–40% of home-service call volume arrives outside business hours.
- Average service ticket: plumbing ~$350–$500, HVAC repair ~$400–$600, HVAC replacement $5k–$12k.
- US market size: ~130k plumbing businesses, ~120k HVAC contractors. Our segment (5–50 employees,
  uses FSM software, does residential service) is conservatively 40–60k companies. We need 38.

**3. Competitors raising and growing (see `02-competitive-landscape.md`).**
Multiple funded startups (Avoca, Sameday, Goodcall, Slang.ai in adjacent verticals) are selling AI
call handling into SMBs and growing. For a bootstrapper, funded competitors in a huge fragmented
market are *good news*: they're spending millions educating the buyer, and they all drift upmarket
to justify their valuations — leaving the 5–50 employee shop underserved.

## Week 1–2 first-hand validation plan (do, don't ask)

### A. The Mystery-Shop Audit (days 1–3) — our own data, and our lead list
Call 100 plumbing/HVAC companies from Google Maps in 3 metro areas, during business hours and at
7pm, posing as a customer with a routine request ("water heater making noise, want someone to look
at it"). Log: answered? rings to answer? voicemail? did anyone call back?

- **Output 1:** A first-party stat ("We called 100 plumbers; X% missed our call; Y% never called
  back"). This becomes the cold-email hook, the homepage stat, and a PR asset.
- **Output 2:** 100 pre-qualified leads — every business that missed the call is a warm prospect
  with personalized proof ("I called you Tuesday at 2:15pm…").
- **Expectation:** 40–60% missed after-hours, 20–35% missed during business hours.

### B. 20 problem interviews (days 3–10)
From the audit list + local trade contacts + HVAC/plumbing owner Facebook groups. 15 minutes each.
Not pitching — asking:
1. Who answers your phone after 5pm today? What does it cost you?
2. Walk me through the last call you know you missed. What was it worth?
3. Have you tried an answering service? Why did you keep/quit it?
4. If a service answered every missed call and booked the job into [their FSM], what would that be
   worth per month?
5. (Last) Would you run a free 2-week trial on your after-hours line?

### C. 5 design-partner commitments (days 7–14)
Convert the best interviews into signed design partners: free 30-day pilot, then $199/mo founding
rate (locked for life) if it books jobs. Get it in writing (simple one-page LOI).

## Kill / pivot criteria (decided in advance, so I can't rationalize later)

| Signal by end of week 2 | Decision |
|---|---|
| <20% of audited businesses miss calls | Pain overstated → pivot vertical (med spas, dental, auto repair — same product) |
| <5 of 20 interviewees currently pay for or assign after-hours coverage | No existing budget → re-examine pricing/segment |
| <3 design partners willing to forward their real line | Trust barrier too high for a solo founder → pivot to selling through agencies (white-label) |
| ≥3 design partners live by week 6 and ≥1 booked job per partner per week | **Green light. Full send.** |

## What we will NOT do to "validate"
- No surveys, no landing-page-only smoke tests (this buyer doesn't browse), no waiting for
  statistical significance. Five shop owners forwarding their real phone line to our software is
  worth more than 500 survey responses.
