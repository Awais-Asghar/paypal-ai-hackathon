DROP INDEX "checkins_hold_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_hold_uq" ON "checkins" USING btree ("hold_id");