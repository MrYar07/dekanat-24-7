"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { AnnouncementFormState } from "../actions";

const CONTROL =
  "border-border bg-surface focus:border-brand aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border px-3.5 py-3 text-base outline-none";

function plural(n: number, forms: [string, string, string]) {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? forms[0] : d >= 2 && d <= 4 && (h < 12 || h > 14) ? forms[1] : forms[2];
}

export function AnnouncementForm({
  action,
  groups,
  titleMax,
  bodyMax,
}: {
  action: (prev: AnnouncementFormState, form: FormData) => Promise<AnnouncementFormState>;
  groups: { id: string; name: string }[];
  titleMax: number;
  bodyMax: number;
}) {
  // Форму сбрасывает сам React после action: при успехе поля пустеют (values нет),
  // при ошибке возвращаются введённые значения из state.values. Поля неуправляемые, поэтому сброс им не вредит.
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <label htmlFor="announcement-audience" className="block text-sm font-medium">
          Кому
        </label>
        <select
          id="announcement-audience"
          name="audience"
          defaultValue={v?.audience ?? "all"}
          aria-invalid={state.fields?.audience ? true : undefined}
          className={CONTROL}
        >
          <option value="all">Всем студентам</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              Группа {g.name}
            </option>
          ))}
        </select>
        {state.fields?.audience && <p className="text-danger mt-1 text-sm">{state.fields.audience}</p>}
      </div>

      <TextField
        label="Заголовок"
        name="title"
        defaultValue={v?.title}
        maxLength={titleMax}
        placeholder="Например: Третий срез — 23–27 ноября"
        error={state.fields?.title}
      />

      <div>
        <label htmlFor="announcement-body" className="block text-sm font-medium">
          Текст
        </label>
        <textarea
          id="announcement-body"
          name="body"
          rows={4}
          maxLength={bodyMax}
          defaultValue={v?.body}
          aria-invalid={state.fields?.body ? true : undefined}
          aria-describedby="announcement-body-hint"
          className={CONTROL}
        />
        {state.fields?.body ? (
          <p className="text-danger mt-1 text-sm">{state.fields.body}</p>
        ) : (
          <p id="announcement-body-hint" className="text-muted mt-1 text-sm">
            До {bodyMax} знаков. В уведомлении студент увидит начало текста.
          </p>
        )}
      </div>

      {state.error && !state.fields && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full py-3">
        {pending ? "Публикуем…" : "Опубликовать"}
      </Button>

      <p role="status" aria-live="polite" className="text-sm">
        {state.at && !state.error && (
          <span className="inline-flex items-start gap-1.5">
            <Check className="text-ok mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Опубликовано. Уведомление {plural(state.recipients ?? 0, ["получил", "получили", "получили"])} {state.recipients}{" "}
            {plural(state.recipients ?? 0, ["студент", "студента", "студентов"])}.
          </span>
        )}
      </p>
    </form>
  );
}
