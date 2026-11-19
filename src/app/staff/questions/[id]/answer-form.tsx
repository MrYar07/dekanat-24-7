"use client";

import { startTransition, useActionState, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ANSWER_MAX, templatesFor } from "@/lib/questions";
import type { AnswerFormState } from "../actions";

export function AnswerForm({
  action,
  topic,
}: {
  action: (prev: AnswerFormState, form: FormData) => Promise<AnswerFormState>;
  topic: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const field = useRef<HTMLTextAreaElement>(null);

  // Готовый ответ встаёт в поле — пустое заменяет, к начатому добавляется новым абзацем. Дальше его можно править.
  function insert(text: string) {
    const el = field.current;
    if (!el) return;
    const current = el.value.trim();
    el.value = (current ? `${current}\n\n${text}` : text).slice(0, ANSWER_MAX);
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

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
          ref={field}
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

      <div role="group" aria-labelledby="templates-title">
        <p id="templates-title" className="text-sm font-medium">
          Готовые ответы
        </p>
        <p className="text-muted text-sm">Вставляются в поле — перед отправкой их можно поправить.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {templatesFor(topic).map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => insert(t.text)}
              aria-label={`Вставить готовый ответ: ${t.label}`}
              className="border-border bg-surface hover:bg-surface-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150"
            >
              {t.label}
            </button>
          ))}
        </div>
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
