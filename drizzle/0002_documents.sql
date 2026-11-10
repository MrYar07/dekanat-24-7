CREATE TABLE "issued_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"request_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"code" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "issued_documents_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "issued_documents_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "issued_documents" ADD CONSTRAINT "issued_documents_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_documents" ADD CONSTRAINT "issued_documents_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issued_documents_student_idx" ON "issued_documents" USING btree ("student_id");