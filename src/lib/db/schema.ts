import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const HOLD_STATES = [
  "DRAFT",
  "HELD",
  "ASSESSING",
  "COOLING_OFF",
  "VERIFYING",
  "APPROVED",
  "RELEASED",
  "DENIED",
  "VOIDED",
  "CANCELLED",
] as const;
export type HoldState = (typeof HOLD_STATES)[number];

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const holdState = pgEnum("hold_state", HOLD_STATES);
export const riskLevel = pgEnum("risk_level", RISK_LEVELS);
export const memberRole = pgEnum("member_role", ["protected", "trusted"]);
export const holdPurpose = pgEnum("hold_purpose", ["family", "bills", "shopping", "other"]);
export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "identity_matched",
  "identity_mismatch",
  "confirmed",
  "denied",
  "expired",
]);
export const decisionKind = pgEnum("decision_kind", ["approve", "deny"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const circles = pgTable("circles", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdAt: createdAt(),
});

export const members = pgTable(
  "members",
  {
    id: uuid().primaryKey().defaultRandom(),
    circleId: uuid("circle_id").notNull().references(() => circles.id),
    role: memberRole().notNull(),
    name: text().notNull(),
    // Contact details saved at setup. Verification links only ever go here, never to caller-supplied contacts.
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    // Stable PayPal identity from Log In with PayPal (payer_id). Set once at setup, then used to match every verification.
    paypalPayerId: text("paypal_payer_id"),
    paypalEmail: text("paypal_email"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("members_circle_idx").on(t.circleId), uniqueIndex("members_payer_id_uq").on(t.paypalPayerId)],
);

export const payees = pgTable(
  "payees",
  {
    id: uuid().primaryKey().defaultRandom(),
    circleId: uuid("circle_id").notNull().references(() => circles.id),
    label: text().notNull(),
    paypalEmail: text("paypal_email").notNull(),
    // Set when the payee is a family member; payouts then go to that member's verified PayPal ID only.
    memberId: uuid("member_id").references(() => members.id),
    known: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("payees_circle_idx").on(t.circleId), index("payees_member_idx").on(t.memberId)],
);

export const holds = pgTable(
  "holds",
  {
    id: uuid().primaryKey().defaultRandom(),
    circleId: uuid("circle_id").notNull().references(() => circles.id),
    payeeId: uuid("payee_id").notNull().references(() => payees.id),
    amountCents: integer("amount_cents").notNull(),
    currency: char({ length: 3 }).notNull(),
    purpose: holdPurpose().notNull(),
    // The family member the story is about ("it's me, Ethan"). Drives the "Is this really you?" check.
    namedMemberId: uuid("named_member_id").references(() => members.id),
    story: text(),
    // Judge Mode only: which demo scenario created this hold (src/lib/demo/scenarios.ts).
    demoScenario: text("demo_scenario"),
    state: holdState().notNull().default("DRAFT"),
    risk: riskLevel(),
    redFlags: jsonb("red_flags").$type<string[]>(),
    riskReasons: jsonb("risk_reasons").$type<string[]>(),
    paypalOrderId: text("paypal_order_id"),
    paypalAuthorizationId: text("paypal_authorization_id"),
    paypalCaptureId: text("paypal_capture_id"),
    payoutBatchId: text("payout_batch_id"),
    payoutStatus: text("payout_status"),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    // Void deadline: set inside the 3-day honor period so funds are never left in limbo.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    coolingOffUntil: timestamp("cooling_off_until", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("holds_amount_positive", sql`${t.amountCents} > 0`),
    index("holds_circle_idx").on(t.circleId, t.createdAt),
    index("holds_state_expires_idx").on(t.state, t.expiresAt),
    uniqueIndex("holds_order_uq").on(t.paypalOrderId),
    uniqueIndex("holds_authorization_uq").on(t.paypalAuthorizationId),
  ],
);

export const checkins = pgTable(
  "checkins",
  {
    id: uuid().primaryKey().defaultRandom(),
    holdId: uuid("hold_id").notNull().references(() => holds.id),
    transcript: jsonb().$type<{ role: "user" | "assistant"; text: string }[]>().notNull().default([]),
    evidence: jsonb().$type<{ kind: string; ref: string }[]>().notNull().default([]),
    verdict: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("checkins_hold_uq").on(t.holdId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    holdId: uuid("hold_id").notNull().references(() => holds.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    // Only the SHA-256 of the link token is stored, so a database leak can't be replayed as a link.
    tokenHash: text("token_hash").notNull(),
    status: verificationStatus().notNull().default("pending"),
    paypalPayerIdSeen: text("paypal_payer_id_seen"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("verifications_token_uq").on(t.tokenHash), index("verifications_hold_idx").on(t.holdId)],
);

export const decisions = pgTable(
  "decisions",
  {
    id: uuid().primaryKey().defaultRandom(),
    holdId: uuid("hold_id").notNull().references(() => holds.id),
    memberId: uuid("member_id").references(() => members.id),
    actor: text().notNull(),
    decision: decisionKind().notNull(),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [index("decisions_hold_idx").on(t.holdId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    holdId: uuid("hold_id").references(() => holds.id),
    fromState: holdState("from_state"),
    toState: holdState("to_state"),
    actor: text().notNull(),
    detail: jsonb().$type<Record<string, unknown>>(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_hold_idx").on(t.holdId, t.at)],
);

export const webhookEvents = pgTable("webhook_events", {
  // PayPal event ID; the primary key is what de-duplicates retried deliveries.
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  resourceId: text("resource_id"),
  payload: jsonb().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export type Hold = typeof holds.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Payee = typeof payees.$inferSelect;
export type Verification = typeof verifications.$inferSelect;

// Messages to circle members, written by the gate when it needs someone (a verification link).
// Delivery (email) is a separate step; Judge Mode reads this table to show the family member's phone.
export const outbox = pgTable(
  "outbox",
  {
    id: uuid().primaryKey().defaultRandom(),
    holdId: uuid("hold_id").references(() => holds.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    channel: text().notNull(),
    to: text(),
    subject: text().notNull(),
    body: text().notNull(),
    link: text(),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("outbox_member_idx").on(t.memberId, t.createdAt)],
);

export type Checkin = typeof checkins.$inferSelect;

export type ReportBody = {
  summary: string;
  whatHappened: string[];
  reportText: string;
  nextSteps: string[];
};

// Aftercare: one scam report draft per hold, written by the AI (or a template when no model answers).
// Amounts, dates and the outcome are never stored here; the page reads them from the hold itself.
export const reports = pgTable("reports", {
  id: uuid().primaryKey().defaultRandom(),
  holdId: uuid("hold_id").notNull().unique("reports_hold_uq").references(() => holds.id),
  body: jsonb().$type<ReportBody>().notNull(),
  source: text().notNull(),
  createdAt: createdAt(),
});

export type Report = typeof reports.$inferSelect;
