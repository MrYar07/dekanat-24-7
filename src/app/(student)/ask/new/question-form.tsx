"use client";

import { startTransition, useActionState, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUESTION_TOPICS, TEXT_MAX } from "@/lib/questions";
import { askQuestionAction, type AskFormState } from "../actions";

const FIELD =
  "border-border-strong bg-surface focus:border-brand aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border px-3.5 py-3 text-base";

export function QuestionForm({ initialText, initialTopic }: { initialText: string; initialTopic?: string }) {
  const [state, formAction, pending] = useActionState<AskFormState, FormData>(askQuestionAction, {});
  const [text, setText] = useState(state.values?.text ?? initialText);
  const topicError = state.fields?.topic;
  const textError = state.fields?.text;

  return (
    <form
      action={formAction}
      // С JS отправляем сами, чтобы React не сбрасывал форму после ошибки.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
      noValidate
    >
      <div>
        <label htmlFor="question-topic" className="block text-sm font-medium">
          Тема
        </label>
        <select
          id="question-topic"
          name="topic"
          defaultValue={state.values?.topic ?? initialTopic ?? ""}
          aria-invalid={topicError ? true : undefined}
          aria-describedby={topicError ? "question-topic-error" : undefined}
          className={FIELD}
        >
          <option value="" disabled>
            Выбери тему
          </option>
          {QUESTION_TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {topicError && (
          <p id="question-topic-error" className="text-danger mt-1 text-sm">
            {topicError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="question-text" className="block text-sm font-medium">
          Вопрос
        </label>
        <textarea
          id="question-text"
          name="text"
          rows={5}
          maxLength={TEXT_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: можно ли перенести пересдачу по эконометрике на другой день?"
          aria-invalid={textError ? true : undefined}
          aria-describedby={`question-text-hint${textError ? " question-text-error" : ""}`}
          className={FIELD}
        />
        <p id="question-text-hint" className="text-muted mt-1 flex justify-between gap-3 text-sm">
          <span>Пароли и данные карт не пиши: деканату они не нужны.</span>
          <span className="shrink-0 tabular-nums">
            {text.length} / {TEXT_MAX}
          </span>
        </p>
        {textError && (
          <p id="question-text-error" className="text-danger mt-1 text-sm">
            {textError}
          </p>
        )}
      </div>

      {state.error && !state.fields && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
        <Send className="size-4" aria-hidden="true" />
        {pending ? "Отправляем…" : "Отправить в деканат"}
      </Button>
    </form>
  );
}
