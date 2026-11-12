"use client";

import { startTransition, useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScoresFormState } from "../../actions";

type Student = { id: string; name: string; score: number | null; others: { number: number; score: number | null }[] };

function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

function resultText(s: ScoresFormState) {
  const saved = s.saved ?? 0;
  const cleared = s.cleared ?? 0;
  if (saved === 0 && cleared === 0) return "Изменений нет.";
  const parts = [];
  if (saved) parts.push(`Сохранено: ${saved} ${plural(saved, "балл", "балла", "баллов")}. Студенты получили уведомления.`);
  if (cleared) parts.push(`Снято: ${cleared}.`);
  return parts.join(" ");
}

export function JournalForm({
  action,
  cpNumber,
  students,
}: {
  action: (prev: ScoresFormState, form: FormData) => Promise<ScoresFormState>;
  cpNumber: number;
  students: Student[];
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      // Отправляем сами: React 19 после action сбрасывает форму, а введённые баллы должны остаться на месте.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      // Enter в поле балла — переход к следующему студенту, а не отправка всей формы посреди ввода.
      onKeyDown={(e) => {
        if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement)) return;
        e.preventDefault();
        const inputs = [...e.currentTarget.querySelectorAll<HTMLInputElement>("input[data-score]")];
        const next = inputs[inputs.indexOf(e.target) + 1];
        if (next) {
          next.focus();
          next.select();
        } else {
          e.currentTarget.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
        }
      }}
      noValidate
    >
      <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
        {students.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-muted w-5 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
            <label htmlFor={`score-${s.id}`} className="min-w-0 flex-1">
              <span className="block leading-snug font-medium">{s.name}</span>
              <span className="text-muted block text-xs tabular-nums">
                {s.others.map((o) => `срез ${o.number}: ${o.score ?? "—"}`).join(" · ")}
              </span>
            </label>
            <input
              id={`score-${s.id}`}
              name={`score:${s.id}`}
              data-score
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              defaultValue={s.score ?? ""}
              placeholder="—"
              aria-label={`${s.name}, балл за срез ${cpNumber}`}
              className="border-border bg-bg focus:border-brand w-20 shrink-0 [appearance:textfield] rounded-lg border px-3 py-2 text-center font-serif text-lg font-bold tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </li>
        ))}
      </ul>

      <div className="bg-bg sticky bottom-0 -mx-4 mt-4 flex flex-wrap items-center gap-3 px-4 py-3 md:mx-0 md:px-0">
        <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
          {pending ? "Сохраняем…" : `Сохранить срез ${cpNumber}`}
        </Button>
        <p role="status" aria-live="polite" className="min-w-0 flex-1 text-sm">
          {state.error ? (
            <span className="text-danger">{state.error}</span>
          ) : state.at ? (
            <span className="inline-flex items-start gap-1.5">
              <Check className="text-ok mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {resultText(state)}
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
