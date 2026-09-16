CREATE TYPE "public"."round_event_type" AS ENUM('ROUND_STARTED', 'TILE_SAFE', 'TILE_TRAP', 'CASHOUT', 'ROUND_WON', 'ROUND_LOST');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('active', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."demo_session_status" AS ENUM('active', 'expired');--> statement-breakpoint
CREATE TABLE "demo_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"demo_credits" numeric(14, 4) NOT NULL,
	"status" "demo_session_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"event_type" "round_event_type" NOT NULL,
	"tile_id" integer,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"bet" numeric(14, 4) NOT NULL,
	"trap_count" integer NOT NULL,
	"status" "round_status" DEFAULT 'active' NOT NULL,
	"multiplier" numeric(14, 4) NOT NULL,
	"potential_loot" numeric(14, 4) NOT NULL,
	"payout" numeric(14, 4) DEFAULT '0' NOT NULL,
	"trap_tile_ids" integer[] NOT NULL,
	"revealed_tile_ids" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "round_events" ADD CONSTRAINT "round_events_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_session_id_demo_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "round_events_round_idx" ON "round_events" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "round_events_created_idx" ON "round_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rounds_session_created_idx" ON "rounds" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "rounds_status_idx" ON "rounds" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_one_active_per_session_idx" ON "rounds" USING btree ("session_id") WHERE "status" = 'active';
