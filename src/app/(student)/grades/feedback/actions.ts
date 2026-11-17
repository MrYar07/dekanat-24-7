"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { submitMyFeedback } from "@/lib/data/feedback";
import type { FeedbackErrors } from "@/lib/feedback";

export type FeedbackFormState = { error?: string; fields?: FeedbackErrors; values?: Record<string, string> };

/** Студент оценивает курс. После ответа — к списку курсов с благодарностью. */
export async function submitFeedbackAction(courseId: string, _prev: FeedbackFormState, form: FormData): Promise<FeedbackFormState> {
  const values = Object.fromEntries(
    ["clarity", "usefulness", "fairness", "comment"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const result = await submitMyFeedback(courseId, values);
  if (!result.ok) return { error: result.error, fields: result.fields, values };
  revalidatePath("/grades/feedback");
  redirect("/grades/feedback?thanks=1");
}
