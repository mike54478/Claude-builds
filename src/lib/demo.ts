/**
 * Demo mode: active whenever no database is configured (or forced via env).
 * Lets the app deploy and demo with ZERO external services — the dashboard
 * and the customer-facing review page render rich sample data instead.
 */
export const DEMO_MODE =
  process.env.DEMO_MODE === "1" || !process.env.DATABASE_URL;

export const demoBusiness = {
  name: "Lakeside Dental",
  city: "Austin, TX",
  locations: ["Lakeside Dental — Downtown", "Lakeside Dental — Round Rock", "Lakeside Dental — Cedar Park"],
};

export const demoStats = [
  { label: "Reviews (30d)", value: "128" },
  { label: "Avg rating (30d)", value: "4.6" },
  { label: "Requests sent (30d)", value: "412" },
  { label: "Median response time", value: "42 min" },
];

export type DemoReview = {
  id: string;
  author: string;
  rating: number;
  location: string;
  age: string;
  body: string;
  sentiment: "positive" | "negative" | "mixed";
  topics: string[];
  flags: string[];
  draft: string;
  draftStatus: "auto-published" | "awaiting approval" | "blocked — human review required";
  confidence: number;
};

export const demoReviews: DemoReview[] = [
  {
    id: "demo-1",
    author: "Maria G.",
    rating: 5,
    location: "Downtown",
    age: "2h ago",
    body: "Dr. Patel and Jenna were amazing with my daughter — she's been terrified of dentists her whole life and they had her laughing in the chair. Booking was easy and we were seen right on time.",
    sentiment: "positive",
    topics: ["staff_friendliness", "punctuality", "scheduling"],
    flags: [],
    draft:
      "Thank you, Maria! Helping nervous patients feel at ease is exactly what Dr. Patel and Jenna love most about their work — your daughter's laughter made their day too. We'll see you both at the next check-up! — The Lakeside Dental team",
    draftStatus: "auto-published",
    confidence: 0.96,
  },
  {
    id: "demo-2",
    author: "Derek W.",
    rating: 2,
    location: "Round Rock",
    age: "5h ago",
    body: "The cleaning itself was fine but I waited 50 minutes past my appointment time and nobody told me what was going on. My whole afternoon was thrown off.",
    sentiment: "negative",
    topics: ["wait_time", "communication"],
    flags: [],
    draft:
      "Derek, you're right to be frustrated — waiting 50 minutes with no update isn't the experience we want anyone to have, and we're sorry we threw off your afternoon. Our Round Rock office manager, Casey, would like to make this right: please call us at (512) 555-0142. — The Lakeside Dental team",
    draftStatus: "awaiting approval",
    confidence: 0.54,
  },
  {
    id: "demo-3",
    author: "T. Nguyen",
    rating: 4,
    location: "Cedar Park",
    age: "1d ago",
    body: "Great hygienist and a spotless office. Only gripe is the billing — I was quoted one number and charged another, though they did fix it when I called.",
    sentiment: "mixed",
    topics: ["quality_of_work", "cleanliness", "pricing_billing"],
    flags: [],
    draft:
      "Thank you for the kind words about our hygiene team and for flagging the billing mix-up — we're glad it was resolved quickly, and we've reviewed the quote process so it doesn't happen again. We appreciate you giving us the chance to fix it. — The Lakeside Dental team",
    draftStatus: "awaiting approval",
    confidence: 0.71,
  },
  {
    id: "demo-4",
    author: "Anonymous",
    rating: 1,
    location: "Downtown",
    age: "1d ago",
    body: "Botched my filling and now I'm in constant pain. I've already spoken to a lawyer. Expect to hear from them unless you refund everything.",
    sentiment: "negative",
    topics: ["quality_of_work", "pain_comfort"],
    flags: ["legal_threat", "health_safety"],
    draft:
      "We take concerns about treatment and comfort very seriously, and we'd like to understand what happened. Please contact our patient care line at (512) 555-0100 so the right person can speak with you directly.",
    draftStatus: "blocked — human review required",
    confidence: 0.18,
  },
];

export const demoTopics = [
  { topic: "Staff friendliness", positive: 41, negative: 2, trend: "+8" },
  { topic: "Quality of work", positive: 33, negative: 4, trend: "+2" },
  { topic: "Wait time", positive: 3, negative: 12, trend: "+5 ⚠" },
  { topic: "Pricing & billing", positive: 5, negative: 8, trend: "−1" },
  { topic: "Cleanliness", positive: 19, negative: 0, trend: "+3" },
];
