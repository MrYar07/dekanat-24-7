"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { QUESTIONS } from "@/lib/feedback";
import type { FeedbackFormState } from "../actions";

export function FeedbackForm({
  action,
  questions,
  commentMax,
}: {
  action: (prev: FeedbackFormState, form: FormData) => Promise<FeedbackFormState>;
  questions: typeof QUESTIONS;
  commentMax: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {questions.map((q) => {
        const error = state.fields?.[q.key];
        return (
          <fieldset key={q.key} aria-describedby={error ? `${q.key}-error` : undefined}>
            <legend className="font-medium">{q.label}</legend>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className="border-border has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand cursor-pointer rounded-lg border py-2.5 text-center text-lg font-semibold tabular-nums has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
                >
                  <input type="radio" name={q.key} value={n} defaultChecked={v?.[q.key] === String(n)} className="sr-only" />
                  {n}
                </label>
              ))}
            </div>
            <div className="text-muted mt-1 flex justify-between text-xs" aria-hidden="true">
              <span>1 — {q.low}</span>
              <span>5 — {q.high}</span>
            </div>
            {error && (
              <p id={`${q.key}-error`} className="text-danger mt-1 text-sm">
                {error}
              </p>
            )}
          </fieldset>
        );
      })}

      <div>
        <label htmlFor="feedback-comment" className="block font-medium">
          Что стоит сохранить или изменить? <span className="text-muted font-normal">(необязательно)</span>
        </label>
        <textarea
          id="feedback-comment"
          name="comment"
          rows={4}
          maxLength={commentMax}
          defaultValue={v?.comment}
          aria-invalid={state.fields?.comment ? true : undefined}
          aria-describedby="feedback-comment-hint"
          className="border-border-strong bg-surface focus:border-brand aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border px-3.5 py-3 text-base"
        />
        {state.fields?.comment ? (
          <p className="text-danger mt-1 text-sm">{state.fields.comment}</p>
        ) : (
          <p id="feedback-comment-hint" className="text-muted mt-1 text-sm">
            Не пиши того, по чему тебя легко узнать: комментарий преподаватель прочитает дословно.
          </p>
        )}
      </div>

      {state.error && !state.fields && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
        {pending ? "Отправляем…" : "Отправить анонимно"}
      </Button>
    </form>
  );
}
