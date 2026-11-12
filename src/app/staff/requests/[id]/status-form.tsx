"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { StatusFormState } from "../../actions";

const OPTION: Record<string, { label: string; hint: string; placeholder: string; submit: string }> = {
  in_review: {
    label: "Взять в работу",
    hint: "Студент увидит, что заявкой занимаются.",
    placeholder: "Необязательно: кому передано, чего ждём",
    submit: "Взять в работу",
  },
  ready: {
    label: "Готово",
    hint: "Где и когда забрать документ.",
    placeholder: "Например: забрать в каб. 214, печать уже стоит",
    submit: "Отметить готовым",
  },
  issued: {
    label: "Выдано",
    hint: "Документ у студента, заявка закрывается.",
    placeholder: "Необязательно",
    submit: "Отметить выданным",
  },
  rejected: {
    label: "Отклонить",
    hint: "Причина обязательна: студент увидит её в уведомлении и в заявке.",
    placeholder: "Причина отказа",
    submit: "Отклонить заявку",
  },
};

export function StatusForm({
  action,
  next,
}: {
  action: (prev: StatusFormState, form: FormData) => Promise<StatusFormState>;
  next: string[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [choice, setChoice] = useState<string>(next[0]);
  const o = OPTION[choice];

  return (
    <form
      action={formAction}
      // Отправляем сами, чтобы React не сбрасывал форму после ошибки (см. order-form.tsx).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Что сделать</legend>
        <div className="flex flex-wrap gap-2">
          {next.map((s) => (
            <label
              key={s}
              className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm has-[:focus-visible]:outline-2 ${
                choice === s
                  ? s === "rejected"
                    ? "border-danger bg-danger-soft text-danger font-semibold"
                    : "border-brand bg-brand-soft text-brand font-semibold"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              <input
                type="radio"
                name="status"
                value={s}
                checked={choice === s}
                onChange={() => setChoice(s)}
                className="sr-only"
              />
              {OPTION[s].label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="status-note" className="block text-sm font-medium">
          Комментарий для студента
        </label>
        <textarea
          id="status-note"
          name="note"
          rows={2}
          maxLength={300}
          defaultValue={state.note}
          placeholder={o.placeholder}
          aria-describedby="status-note-hint"
          className="border-border bg-surface focus:border-brand mt-1 block w-full rounded-lg border px-3.5 py-3 text-base outline-none"
        />
        <p id="status-note-hint" className="text-muted mt-1 text-sm">
          {o.hint}
        </p>
      </div>

      {state.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        variant={choice === "rejected" ? "danger" : "primary"}
        disabled={pending}
        className="w-full py-3 sm:w-auto"
      >
        {pending ? "Сохраняем…" : o.submit}
      </Button>
    </form>
  );
}
