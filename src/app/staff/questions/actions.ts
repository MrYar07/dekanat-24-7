"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { answerQuestion } from "@/lib/data/staff/dean-questions";

export type AnswerFormState = { error?: string; answer?: string };

/** Деканат отвечает на вопрос студента. Роль, статус и длину проверяет слой данных. */
export async function answerQuestionAction(questionId: string, _prev: AnswerFormState, form: FormData): Promise<AnswerFormState> {
  const answer = String(form.get("answer") ?? "");
  const result = await answerQuestion(questionId, answer);
  if (!result.ok) return { error: result.error, answer };
  revalidatePath("/staff", "layout");
  redirect(`/staff/questions/${questionId}?done=1`);
}
