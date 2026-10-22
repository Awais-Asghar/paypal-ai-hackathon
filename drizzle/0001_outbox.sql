CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid,
	"member_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"to" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_member_idx" ON "outbox" USING btree ("member_id","created_at");