# Financial Model — Costs, Unit Economics, Conversion Rates

All figures are planning estimates; the model is rebuilt with actuals every Friday (see weekly
cadence in `09-180-day-plan.md`). Assumptions are deliberately conservative — the plan must survive
its own pessimism.

## Operating costs

### Phase 1 — Validation & build (months 1–2): ~$350–450/mo
| Item | $/mo |
|---|---|
| Voice platform usage (Vapi/Retell + Twilio, testing + design partners) | 150 |
| Cold-email infra (3 domains, 3 inboxes, sending tool e.g. Instantly/Smartlead) | 110 |
| Lead scraping (Apify/Outscraper credits) | 50 |
| Hosting (Fly.io/Railway), domain, Google Workspace | 40 |
| LLM API (QA, summaries, internal tools) | 30 |

**"$0 starting capital" honestly:** true cash need before first revenue is **~$800–1,000 total**
(2 months of the above). That's a credit card and free tiers, retired by the first 3–4 founding
customers (week 6–8 revenue ≈ $600–1,000/mo). Founder living costs are the real cost — this plan
assumes 6 months of personal runway or a side income; the business itself never needs outside money.

### Phase 2 — Scale (months 3–6): grows with revenue
| Item | M3 | M6 |
|---|---|---|
| COGS — voice minutes (below) | ~$250 | ~$1,300 |
| Email/lead infra + tools (billing, support, analytics) | 250 | 350 |
| VA (audits, list-building, data entry — from month 2–3) | 400 | 700 |
| Hosting + LLM | 70 | 150 |
| **Total opex** | **~$970** | **~$2,500** |

### COGS per customer (the number that matters)
- Managed pipeline (months 1–4): ~**$0.13/min** all-in (platform + STT + TTS + LLM + telephony).
- Self-built pipeline (month 5+): ~**$0.07–0.09/min**.
- Average customer: ~70 handled calls/mo × 3.5 min ≈ **245 min/mo** → **$32/mo (managed) → $20/mo
  (self-built)**.
- At $280 blended ARPU: **~88% gross margin**, rising to ~92%. Overage pricing ($0.35–0.45/min vs.
  ~$0.10 cost) protects against heavy users; minute caps per plan are the safety valve.

## Conversion-rate model (conservative case)

### Channel assumptions
| Stage | Rate | Basis |
|---|---|---|
| Cold dial → live conversation | 18% | SMB trades; calling at 7:30am/5pm; mobile numbers where available |
| Conversation → demo booked | 12% | With missed-call proof opener (generic openers: assume 6–8%) |
| Demo booked → demo held | 60% | 40% no-show, same-day booking + SMS reminders |
| Cold email → reply | 4% | Personalized "called you Tuesday" hook |
| Reply → demo held | 25% | |
| **Demo held → trial started** | **55%** | Free, zero-risk, we do the setup |
| **Trial → paid** | **55%** | Trial proves ROI in their own dollars; <40% = product problem, stop selling and fix |
| Demo held → paid (blended) | ~30% | |
| Referral/inbound lead → paid | 40–50% | Pre-sold by a peer |

### Weekly pipeline arithmetic (steady state, months 2–6)
- 150 dials → 27 conversations → ~3.2 demos booked → ~2 held
- 250 emails → 10 replies → ~2.5 demos booked → ~1.5 held
- Communities/referrals/audit inbound → ~1–1.5 held
- **≈ 4.5–5 demos held/week → ~2.5 trials → ~1.4 closes/week** from cold channels alone,
  rising to **~2/week** by month 4 as referrals and marketplace listings layer in.

### MRR build (38 customers @ ~$280 blended = $10.6k; churn 2.5%/mo grossed in)
| Month-end | New adds | Customers | MRR |
|---|---|---|---|
| M1 | 0 (validation + build) | 0 | $0 |
| M2 | 5 (design partners convert, founding rate) | 5 | ~$1,000 |
| M3 | 6 | 11 | ~$2,600 |
| M4 | 8 | 18 | ~$4,600 |
| M5 | 9 | 27 | ~$7,200 |
| M6 | 12 | 38 | **~$10,400** |

The ramp (5→6→8→9→12 adds) reflects: sales hours freed as onboarding templatizes, referral loop
starting month 3, founding-customer proof improving close rates, and a VA absorbing list-building.
**Stress test:** if every conversion rate above is cut by 25%, month 6 lands at ~$7k MRR and $10k
arrives in month 8 — the business still works, the deadline slips. The model's true sensitivity is
**trial→paid**: below 40%, stop scaling outbound and fix the product; above 60%, raise prices.

### Unit economics summary
- **CAC:** ~$60 cash (tooling amortized) + ~6 founder-hours per close. Post-founder-sales estimate:
  ~$500–700 — still <3 months payback at $280 ARPU.
- **LTV at 2.5%/mo churn:** $280 × 40 months × 88% margin ≈ **$9,800** → LTV:CAC ≈ 15:1 founder-led.
- **Cash flow positive from ~month 3** (opex ~$1k vs. MRR ~$2.6k). Annual-prepay closes (target 30%
  of deals) pull cash forward and are the bootstrap war chest.
