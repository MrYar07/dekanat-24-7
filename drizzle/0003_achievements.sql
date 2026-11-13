CREATE TABLE "achievement_files" (
	"achievement_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "achievement_files" ADD CONSTRAINT "achievement_files_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;