"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { askMyQuestion } from "@/lib/data/questions";
import type { QuestionErrors } from "@/lib/questions";

export type AskFormState = { error?: string; fields?: QuestionErrors; values?: { topic: string; text: string } };

/** Студент пишет в деканат. Тему, длину и предел вопросов без ответа проверяет слой данных. */
export async function askQuestionAction(_prev: AskFormState, form: FormData): Promise<AskFormState> {
  const values = { topic: String(form.get("topic") ?? ""), text: String(form.get("text") ?? "") };
  const result = await askMyQuestion(values);
  if (!result.ok) return { error: result.error, fields: result.fields, values };
  revalidatePath("/ask");
  redirect(`/ask/${result.questionId}?new=1`);
}
