CREATE TABLE "certification_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"certified" boolean NOT NULL,
	"admin_id" varchar(255) DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" varchar(40) DEFAULT 'agent_shared' NOT NULL,
	"title" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"link" text,
	"agent_id" integer,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) DEFAULT '' NOT NULL,
	"name" text DEFAULT 'Tim Tanpa Judul' NOT NULL,
	"mission" text DEFAULT '',
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"brand_name" text NOT NULL,
	"logo_url" text,
	"primary_color" varchar(32),
	"tagline" text,
	"default_agent_id" text,
	"cheap_model" varchar(64) DEFAULT 'gpt-4o-mini' NOT NULL,
	"seats_per_unit" integer DEFAULT 3 NOT NULL,
	"monthly_quota" integer DEFAULT 0 NOT NULL,
	"quota_month" varchar(7),
	"quota_used" integer DEFAULT 0 NOT NULL,
	"hide_platform_branding" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partners_slug_unique" UNIQUE("slug"),
	CONSTRAINT "partners_host_unique" UNIQUE("host")
);
--> statement-breakpoint
CREATE TABLE "pending_premium_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_agent_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"source" varchar(40) DEFAULT 'scalev' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "is_certified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "premium_class" text DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "license_class" integer;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "license_price" integer;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "cloned_from_agent_id" integer;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "user_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "agent_id" integer;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "creator_user_id" text;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "creator_share" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "platform_share" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "selected_claw_packages" varchar[];--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_premium_deliveries_agent_email_unique" ON "pending_premium_deliveries" USING btree ("master_agent_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_clone_owner_unique" ON "agents" USING btree ("cloned_from_agent_id","user_id") WHERE "agents"."cloned_from_agent_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tenders_source_tender_unique" ON "tenders" USING btree ("source_id","tender_id");