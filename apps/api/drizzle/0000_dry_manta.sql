CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket" text NOT NULL,
	"reporter_hash" text NOT NULL,
	"category" text NOT NULL,
	"urgency" integer NOT NULL,
	"summary" text NOT NULL,
	"required_action" text,
	"constituency" text,
	"latitude" text,
	"longitude" text,
	"status" text DEFAULT 'OPEN',
	"assigned_squad" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "incidents_ticket_unique" UNIQUE("ticket")
);
--> statement-breakpoint
CREATE TABLE "misinfo_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_hash" text NOT NULL,
	"verdict" text NOT NULL,
	"explanation" text,
	"sources" jsonb,
	"language" text,
	"response_ms" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roll_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituency_code" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"voter_count" integer,
	"changes_count" integer,
	"taken_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voter_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voter_id" uuid,
	"change_type" text NOT NULL,
	"old_status" text,
	"new_status" text,
	"alert_sent_at" timestamp with time zone,
	"ticket" text
);
--> statement-breakpoint
CREATE TABLE "voters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_hash" text NOT NULL,
	"constituency_code" text NOT NULL,
	"voter_id_hash" text NOT NULL,
	"language" text DEFAULT 'hi',
	"enrolled_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "voter_alerts" ADD CONSTRAINT "voter_alerts_voter_id_voters_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."voters"("id") ON DELETE no action ON UPDATE no action;