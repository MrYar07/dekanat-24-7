ALTER TABLE "terms" ADD COLUMN "academic_year" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "number" smallint DEFAULT 1 NOT NULL;