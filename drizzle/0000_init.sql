CREATE TYPE "public"."decision_kind" AS ENUM('approve', 'deny');--> statement-breakpoint
CREATE TYPE "public"."hold_purpose" AS ENUM('family', 'bills', 'shopping', 'other');--> statement-breakpoint
CREATE TYPE "public"."hold_state" AS ENUM('DRAFT', 'HELD', 'ASSESSING', 'COOLING_OFF', 'VERIFYING', 'APPROVED', 'RELEASED', 'DENIED', 'VOIDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('protected', 'trusted');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'identity_matched', 'identity_mismatch', 'confirmed', 'denied', 'expired');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"hold_id" uuid,
	"from_state" "hold_state",
	"to_state" "hold_state",
	"actor" text NOT NULL,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdict" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid NOT NULL,
	"member_id" uuid,
	"actor" text NOT NULL,
	"decision" "decision_kind" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"payee_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"purpose" "hold_purpose" NOT NULL,
	"named_member_id" uuid,
	"story" text,
	"state" "hold_state" DEFAULT 'DRAFT' NOT NULL,
	"risk" "risk_level",
	"red_flags" jsonb,
	"risk_reasons" jsonb,
	"paypal_order_id" text,
	"paypal_authorization_id" text,
	"paypal_capture_id" text,
	"payout_batch_id" text,
	"payout_status" text,
	"authorized_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cooling_off_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holds_amount_positive" CHECK ("holds"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"paypal_payer_id" text,
	"paypal_email" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"label" text NOT NULL,
	"paypal_email" text NOT NULL,
	"member_id" uuid,
	"known" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"paypal_payer_id_seen" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"resource_id" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_named_member_id_members_id_fk" FOREIGN KEY ("named_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payees" ADD CONSTRAINT "payees_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payees" ADD CONSTRAINT "payees_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_hold_idx" ON "audit_log" USING btree ("hold_id","at");--> statement-breakpoint
CREATE INDEX "checkins_hold_idx" ON "checkins" USING btree ("hold_id");--> statement-breakpoint
CREATE INDEX "decisions_hold_idx" ON "decisions" USING btree ("hold_id");--> statement-breakpoint
CREATE INDEX "holds_circle_idx" ON "holds" USING btree ("circle_id","created_at");--> statement-breakpoint
CREATE INDEX "holds_state_expires_idx" ON "holds" USING btree ("state","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "holds_order_uq" ON "holds" USING btree ("paypal_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holds_authorization_uq" ON "holds" USING btree ("paypal_authorization_id");--> statement-breakpoint
CREATE INDEX "members_circle_idx" ON "members" USING btree ("circle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_payer_id_uq" ON "members" USING btree ("paypal_payer_id");--> statement-breakpoint
CREATE INDEX "payees_circle_idx" ON "payees" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "payees_member_idx" ON "payees" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_token_uq" ON "verifications" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "verifications_hold_idx" ON "verifications" USING btree ("hold_id");