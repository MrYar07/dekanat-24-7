CREATE TABLE "student_card_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_card_tokens" ADD CONSTRAINT "student_card_tokens_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_card_tokens_student_idx" ON "student_card_tokens" USING btree ("student_id");