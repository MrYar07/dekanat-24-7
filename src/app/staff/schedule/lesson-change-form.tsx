"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { LessonFormState } from "../actions";

const CONTROL = "border-border bg-surface focus:border-brand mt-1 block w-full rounded-lg border px-3.5 py-3 text-base outline-none";

const KINDS = [
  { value: "moved", label: "Перенести", submit: "Перенести пару" },
  { value: "cancelled", label: "Отменить", submit: "Отменить пару" },
  { value: "room", label: "Другая аудитория", submit: "Сменить аудиторию" },
] as const;

function plural(n: number, forms: [string, string, string]) {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? forms[0] : d >= 2 && d <= 4 && (h < 12 || h > 14) ? forms[1] : forms[2];
}

function Result({ state }: { state: LessonFormState }) {
  return (
    <p role="status" aria-live="polite" className="text-sm">
      {state.error ? (
        <span className="text-danger">{state.error}</span>
      ) : state.at ? (
        <span className="inline-flex items-start gap-1.5">
          <Check className="text-ok mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Сохранено. Уведомление {plural(state.recipients ?? 0, ["получил", "получили", "получили"])} {state.recipients}{" "}
          {plural(state.recipients ?? 0, ["студент", "студента", "студентов"])}.
        </span>
      ) : null}
    </p>
  );
}

export function LessonChangeForm({
  action,
  pairs,
  minDate,
  maxDate,
  gridDate,
  formId,
}: {
  action: (prev: LessonFormState, form: FormData) => Promise<LessonFormState>;
  /** Время начала пар по сетке. */
  pairs: string[];
  minDate: string;
  maxDate: string;
  /** Дата пары по сетке: подставляется как дата переноса по умолчанию. */
  gridDate: string;
  /** Уникальный ключ пары: на странице несколько таких форм, id полей не должны совпадать. */
  formId: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("moved");
  const current = KINDS.find((k) => k.value === kind)!;

  return (
    <form
      action={formAction}
      // Отправляем сами, чтобы React не сбрасывал форму после ошибки (см. order-form.tsx).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-3"
    >
      <fieldset>
        <legend className="sr-only">Что сделать с парой</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 ${
                kind === k.value ? "border-brand bg-brand-soft text-brand font-semibold" : "border-border text-muted hover:text-text"
              }`}
            >
              <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      {kind === "moved" && (
        <div className="grid grid-cols-2 gap-3">
          <TextField id={`date-${formId}`} label="Новая дата" name="newDate" type="date" min={minDate} max={maxDate} defaultValue={gridDate} required />
          <div>
            <label htmlFor={`start-${formId}`} className="block text-sm font-medium">
              Время
            </label>
            <select id={`start-${formId}`} name="newStartsAt" className={CONTROL} defaultValue={pairs[0]}>
              {pairs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {kind !== "cancelled" && (
        <TextField
          id={`room-${formId}`}
          label={kind === "room" ? "Новая аудитория" : "Аудитория (если другая)"}
          name="newRoom"
          maxLength={40}
          placeholder="ауд. 305"
        />
      )}
      <TextField id={`reason-${formId}`} label="Причина (увидят студенты)" name="reason" maxLength={200} placeholder="Например: преподаватель на конференции" />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} variant={kind === "cancelled" ? "danger" : "primary"} className="w-full sm:w-auto">
          {pending ? "Сохраняем…" : current.submit}
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RestoreButton({ action }: { action: () => Promise<LessonFormState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="secondary" disabled={pending} className="px-3 py-2 text-sm">
        <Undo2 className="size-4" aria-hidden="true" />
        {pending ? "Возвращаем…" : "Вернуть по расписанию"}
      </Button>
      <Result state={state} />
    </form>
  );
}
