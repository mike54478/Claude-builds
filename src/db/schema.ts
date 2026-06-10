import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () => timestamp("created_at").notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* better-auth core tables (default naming) + our org extensions       */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable("session", {
  id: id(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const account = pgTable("account", {
  id: id(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verification = pgTable("verification", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Tenant root. Managed by better-auth's organization plugin; the columns
 * after `metadata` are Repruv extensions (billing + agency hierarchy).
 */
export const organization = pgTable("organization", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: createdAt(),
  // --- Repruv extensions ---
  type: text("type", { enum: ["business", "agency"] })
    .notNull()
    .default("business"),
  parentOrgId: text("parent_org_id"),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan", { enum: ["trial", "starter", "pro", "agency"] })
    .notNull()
    .default("trial"),
});

export const member = pgTable("member", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: createdAt(),
});

export const invitation = pgTable("invitation", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

/* ------------------------------------------------------------------ */
/* Locations                                                           */
/* ------------------------------------------------------------------ */

export type BrandVoice = {
  tone: "warm" | "professional" | "casual" | "formal";
  formality: 1 | 2 | 3 | 4 | 5;
  signOff: string; // e.g. "— The Lakeside Dental team"
  businessDescriptor: string; // "family dental practice in Austin"
  bannedPhrases: string[];
  exampleResponses: string[]; // up to 3 owner-approved examples
};

export type AutoPublishPolicy = {
  enabled: boolean;
  minRating: number; // only auto-publish at/above this rating
  minConfidence: number; // 0..1, model self-assessed
  dailyCap: number;
};

export type QuietHours = { start: string; end: string }; // "21:00" / "09:00" local

export const locations = pgTable(
  "locations",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("America/New_York"),
    phone: text("phone"),
    googlePlaceId: text("google_place_id"),
    /** Public "leave us a review" deep link (Google write-review URL). */
    reviewLink: text("review_link"),
    brandVoice: jsonb("brand_voice").$type<BrandVoice | null>(),
    autoPublishPolicy: jsonb("auto_publish_policy")
      .$type<AutoPublishPolicy>()
      .notNull()
      .default({ enabled: false, minRating: 5, minConfidence: 0.85, dailyCap: 25 }),
    quietHours: jsonb("quiet_hours")
      .$type<QuietHours>()
      .notNull()
      .default({ start: "21:00", end: "09:00" }),
    createdAt: createdAt(),
  },
  (t) => [index("locations_org_idx").on(t.orgId)],
);

/* ------------------------------------------------------------------ */
/* Contacts & messaging                                                */
/* ------------------------------------------------------------------ */

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    phone: text("phone"), // E.164
    email: text("email"),
    /** TCPA: when/how we obtained consent to text this person. Required to send SMS. */
    smsConsentAt: timestamp("sms_consent_at"),
    smsConsentSource: text("sms_consent_source"),
    optedOutAt: timestamp("opted_out_at"),
    /** ID in the customer's system of record (PMS / FSM job ID). */
    externalRef: text("external_ref"),
    createdAt: createdAt(),
  },
  (t) => [
    index("contacts_org_idx").on(t.orgId),
    uniqueIndex("contacts_location_phone_uq").on(t.locationId, t.phone),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("conversations_contact_uq").on(t.contactId)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    channel: text("channel", { enum: ["sms", "email"] }).notNull(),
    body: text("body").notNull(),
    media: jsonb("media").$type<string[]>(),
    /** Twilio MessageSid / Resend id — for status callbacks + idempotency. */
    providerSid: text("provider_sid"),
    status: text("status").notNull().default("queued"),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId),
    uniqueIndex("messages_provider_sid_uq").on(t.providerSid),
  ],
);

/* ------------------------------------------------------------------ */
/* Review request sequences (the growth engine)                        */
/* ------------------------------------------------------------------ */

export type SequenceStep = {
  channel: "sms" | "email";
  /** Hours to wait after the previous step (0 for the first step). */
  delayHours: number;
  template: string; // supports {{firstName}}, {{businessName}}, {{link}}
};

export const sequences = pgTable("sequences", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  steps: jsonb("steps").$type<SequenceStep[]>().notNull(),
  createdAt: createdAt(),
});

export type ReviewRequestStatus =
  | "queued"
  | "step_sent"
  | "clicked_review"
  | "clicked_feedback"
  | "feedback_received"
  | "completed"
  | "opted_out"
  | "failed";

export const reviewRequests = pgTable(
  "review_requests",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    sequenceId: text("sequence_id").references(() => sequences.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<ReviewRequestStatus>().notNull().default("queued"),
    /** Index of the next sequence step to send. */
    nextStep: integer("next_step").notNull().default(0),
    /** When the scheduler should next act on this row. */
    nextActionAt: timestamp("next_action_at"),
    /** Public short code for the dual-CTA landing route /r/:code. */
    shortCode: text("short_code")
      .notNull()
      .$defaultFn(() => crypto.randomUUID().slice(0, 8)),
    clickedAt: timestamp("clicked_at"),
    completedAt: timestamp("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("review_requests_short_code_uq").on(t.shortCode),
    index("review_requests_due_idx").on(t.status, t.nextActionAt),
    index("review_requests_org_idx").on(t.orgId, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Reviews, AI analysis, responses                                     */
/* ------------------------------------------------------------------ */

export const reviewSources = pgTable(
  "review_sources",
  {
    id: id(),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["google", "facebook", "yelp"] }).notNull(),
    externalId: text("external_id").notNull(), // place id / page id
    syncCursor: text("sync_cursor"),
    status: text("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at"),
  },
  (t) => [uniqueIndex("review_sources_uq").on(t.locationId, t.provider)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => reviewSources.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalReviewId: text("external_review_id").notNull(),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(), // 1..5
    body: text("body").notNull().default(""),
    publishedAt: timestamp("published_at").notNull(),
    ingestedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_external_uq").on(t.sourceId, t.externalReviewId),
    index("reviews_org_idx").on(t.orgId, t.publishedAt),
    index("reviews_location_idx").on(t.locationId, t.publishedAt),
  ],
);

/** Safety flags that block auto-publish and page a human. */
export type ReviewFlag =
  | "legal_threat"
  | "health_safety"
  | "discrimination_claim"
  | "review_extortion"
  | "contains_pii"
  | "suspected_fake";

export type TopicMention = {
  topic: string; // controlled vocabulary + free-form, e.g. "wait_time"
  sentiment: "positive" | "negative" | "neutral";
  quote: string;
};

export const reviewAnalyses = pgTable("review_analyses", {
  reviewId: text("review_id")
    .primaryKey()
    .references(() => reviews.id, { onDelete: "cascade" }),
  sentiment: text("sentiment", {
    enum: ["positive", "negative", "neutral", "mixed"],
  }).notNull(),
  sentimentScore: real("sentiment_score").notNull(), // -1..1
  topics: jsonb("topics").$type<TopicMention[]>().notNull(),
  staffMentions: jsonb("staff_mentions").$type<string[]>().notNull(),
  summary: text("summary").notNull(),
  flags: jsonb("flags").$type<ReviewFlag[]>().notNull(),
  model: text("model").notNull(),
  analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
});

export const reviewResponses = pgTable(
  "review_responses",
  {
    id: id(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    draft: text("draft").notNull(),
    /** Model's self-assessed publishability, 0..1. */
    confidence: real("confidence").notNull(),
    finalText: text("final_text"),
    status: text("status", {
      enum: ["draft", "approved", "published", "rejected"],
    })
      .notNull()
      .default("draft"),
    autoPublished: boolean("auto_published").notNull().default(false),
    authorUserId: text("author_user_id").references(() => user.id),
    publishedAt: timestamp("published_at"),
    createdAt: createdAt(),
  },
  (t) => [index("review_responses_review_idx").on(t.reviewId)],
);

export const privateFeedback = pgTable(
  "private_feedback",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    rating: integer("rating"),
    body: text("body").notNull(),
    status: text("status", { enum: ["new", "in_progress", "resolved"] })
      .notNull()
      .default("new"),
    createdAt: createdAt(),
  },
  (t) => [index("private_feedback_org_idx").on(t.orgId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Billing & webhook idempotency                                       */
/* ------------------------------------------------------------------ */

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" })
    .unique(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  status: text("status").notNull(), // trialing | active | past_due | canceled
  priceId: text("price_id").notNull(),
  /** Billed quantity = number of active locations. */
  locationQuantity: integer("location_quantity").notNull().default(1),
  currentPeriodEnd: timestamp("current_period_end"),
  updatedAt: updatedAt(),
});

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider", { enum: ["stripe", "twilio"] }).notNull(),
    externalId: text("external_id").notNull(),
    payload: jsonb("payload"),
    processedAt: timestamp("processed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_uq").on(t.provider, t.externalId)],
);
