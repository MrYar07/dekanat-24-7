"use client";

import { startTransition, useActionState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ANSWER_MAX } from "@/lib/questions";
import type { AnswerFormState } from "../actions";

export function AnswerForm({ action }: { action: (prev: AnswerFormState, form: FormData) => Promise<AnswerFormState> }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      // Отправляем сами, чтобы React не сбрасывал текст ответа после ошибки.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
      noValidate
    >
      <div>
        <label htmlFor="answer-text" className="block text-sm font-medium">
          Ответ студенту
        </label>
        <textarea
          id="answer-text"
          name="answer"
          rows={6}
          maxLength={ANSWER_MAX}
          defaultValue={state.answer}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="answer-text-hint"
          className="border-border-strong bg-surface focus:border-brand aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border px-3.5 py-3 text-base"
        />
        <p id="answer-text-hint" className="text-muted mt-1 text-sm">
          Студент получит уведомление с началом ответа. Отправленный ответ не меняется: уточнение — следующим вопросом.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
        <Send className="size-4" aria-hidden="true" />
        {pending ? "Отправляем…" : "Ответить"}
      </Button>
    </form>
  );
}
