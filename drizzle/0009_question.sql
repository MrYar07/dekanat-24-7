CREATE TYPE "public"."question_status" AS ENUM('open', 'answered');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'question';--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"text" text NOT NULL,
	"status" "question_status" DEFAULT 'open' NOT NULL,
	"answer" text,
	"answered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_student_idx" ON "questions" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "questions_status_idx" ON "questions" USING btree ("status","created_at");