CREATE TABLE "course_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"clarity" smallint NOT NULL,
	"usefulness" smallint NOT NULL,
	"fairness" smallint NOT NULL,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "course_feedback_votes" (
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	CONSTRAINT "course_feedback_votes_course_id_student_id_pk" PRIMARY KEY("course_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "course_feedback" ADD CONSTRAINT "course_feedback_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_feedback_votes" ADD CONSTRAINT "course_feedback_votes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_feedback_votes" ADD CONSTRAINT "course_feedback_votes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_feedback_course_idx" ON "course_feedback" USING btree ("course_id");