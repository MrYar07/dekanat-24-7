"use client";

import { startTransition, useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResultsFormState } from "../../../actions";

type Student = { id: string; name: string; activity: number | null; bonus: number; checkpointsMean: number | null };

const one = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function resultText(s: ResultsFormState) {
  if (!s.saved) return "Изменений нет.";
  const parts = [`Сохранено: ${s.saved}.`];
  if (s.bonuses) parts.push(`О бонусе ${s.bonuses === 1 ? "студенту ушло уведомление" : `уведомлены ${s.bonuses} студента`}.`);
  return parts.join(" ");
}

export function ResultsForm({
  action,
  students,
  bonusMax,
}: {
  action: (prev: ResultsFormState, form: FormData) => Promise<ResultsFormState>;
  students: Student[];
  bonusMax: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const bonuses = Array.from({ length: bonusMax + 1 }, (_, i) => i);

  return (
    <form
      action={formAction}
      // Отправляем сами: React 19 после action сбрасывает форму, а введённое должно остаться на месте.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      noValidate
    >
      <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
        {students.map((s, i) => (
          <li key={s.id} className="px-4 py-3 lg:flex lg:items-center lg:gap-4">
            <div className="flex min-w-0 flex-1 items-baseline gap-3">
              <span className="text-muted w-5 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
              <span className="min-w-0">
                <span className="block leading-snug font-medium">{s.name}</span>
                <span className="text-muted block text-xs tabular-nums">
                  {s.checkpointsMean === null ? "срезов пока нет" : `среднее по срезам ${one.format(s.checkpointsMean)}`}
                </span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-4 pl-8 lg:mt-0 lg:shrink-0 lg:pl-0">
              <div>
                <label htmlFor={`activity-${s.id}`} className="text-muted block text-xs">
                  Активность, 0–100
                </label>
                <input
                  id={`activity-${s.id}`}
                  name={`activity:${s.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  defaultValue={s.activity ?? ""}
                  placeholder="—"
                  className="border-border-strong bg-surface focus:border-brand mt-1 block w-24 rounded-lg border px-3 py-2 text-base tabular-nums"
                />
              </div>
              <fieldset>
                <legend className="text-muted text-xs">Бонус</legend>
                <div className="mt-1 flex gap-1">
                  {bonuses.map((b) => (
                    <label
                      key={b}
                      className="border-border has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand grid size-9 cursor-pointer place-items-center rounded-md border text-sm tabular-nums has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
                    >
                      <input
                        type="radio"
                        name={`bonus:${s.id}`}
                        value={b}
                        defaultChecked={s.bonus === b}
                        className="sr-only"
                        aria-label={b === 0 ? `${s.name}: без бонуса` : `${s.name}: бонус +${b}`}
                      />
                      {b === 0 ? "0" : `+${b}`}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </li>
        ))}
      </ul>

      <div className="bg-bg sticky bottom-0 -mx-4 mt-4 flex flex-wrap items-center gap-3 px-4 py-3 md:mx-0 md:px-0">
        <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
          {pending ? "Сохраняем…" : "Сохранить"}
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
