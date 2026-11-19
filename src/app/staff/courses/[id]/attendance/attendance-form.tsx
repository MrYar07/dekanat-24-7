"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttendanceFormState } from "../../../actions";

type Mark = "present" | "absent" | "excused";
type Student = { id: string; name: string; status: Mark | null; absences: number };

const OPTIONS: { value: Mark; label: string; active: string }[] = [
  { value: "present", label: "был", active: "border-ok bg-ok-soft text-ok" },
  // Пропуск — жёлтым «внимание», а не красным: красный в кабинете только для ошибок и переносов.
  { value: "absent", label: "пропуск", active: "border-warn bg-warn-soft text-warn" },
  { value: "excused", label: "уважит.", active: "border-brand bg-brand-soft text-brand" },
];

function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

function resultText(s: AttendanceFormState) {
  const saved = s.saved ?? 0;
  const cleared = s.cleared ?? 0;
  if (saved === 0 && cleared === 0) return "Изменений нет.";
  const parts = [`Сохранено отметок: ${saved}.`];
  if (s.absent) parts.push(`${s.absent} ${plural(s.absent, "студент получил", "студента получили", "студентов получили")} уведомление о пропуске.`);
  if (cleared) parts.push(`Снято: ${cleared}.`);
  return parts.join(" ");
}

export function AttendanceForm({
  action,
  students,
}: {
  action: (prev: AttendanceFormState, form: FormData) => Promise<AttendanceFormState>;
  students: Student[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [marks, setMarks] = useState<Record<string, Mark | null>>(() => Object.fromEntries(students.map((s) => [s.id, s.status])));
  const unmarked = students.filter((s) => !marks[s.id]).length;

  return (
    <form
      action={formAction}
      // Отправляем сами: React 19 после action сбрасывает форму, а отметки должны остаться на месте.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {/* Обычно на паре почти все: сначала «все были», потом поправить тех, кого нет. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          disabled={unmarked === 0}
          onClick={() => setMarks((m) => Object.fromEntries(students.map((s) => [s.id, m[s.id] ?? "present"])))}
        >
          <CheckCheck className="size-4" aria-hidden="true" />
          Остальные были
        </Button>
        <span className="text-muted text-sm">{unmarked > 0 ? `Без отметки: ${unmarked}` : "Отмечены все"}</span>
      </div>

      <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
        {students.map((s, i) => (
          // На телефоне переключатель — под именем на всю ширину, на широком экране — справа.
          <li key={s.id} className="att-row px-4 py-2.5 sm:flex sm:items-center sm:gap-3">
            <div className="flex min-w-0 flex-1 items-baseline gap-3">
              <span className="text-muted w-5 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
              <span className="min-w-0">
                <span className="block leading-snug font-medium">{s.name}</span>
                <span className="text-muted block text-xs tabular-nums">
                  {s.absences === 0 ? "пропусков нет" : `пропусков за триместр: ${s.absences}`}
                </span>
              </span>
            </div>
            <input type="hidden" name={`mark:${s.id}`} value={marks[s.id] ?? ""} />
            <fieldset className="mt-2 grid grid-cols-3 gap-1 pl-8 text-center sm:mt-0 sm:flex sm:shrink-0 sm:pl-0">
              <legend className="sr-only">{s.name}</legend>
              {OPTIONS.map((o) => {
                const on = marks[s.id] === o.value;
                return (
                  <label
                    key={o.value}
                    className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                      on ? `${o.active} font-semibold` : "border-border text-muted hover:text-text"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`ui:${s.id}`}
                      value={o.value}
                      checked={on}
                      onChange={() => setMarks((m) => ({ ...m, [s.id]: o.value }))}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                );
              })}
            </fieldset>
          </li>
        ))}
      </ul>

      <div className="bg-bg sticky bottom-0 -mx-4 mt-4 flex flex-wrap items-center gap-3 px-4 py-3 md:mx-0 md:px-0">
        <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
          {pending ? "Сохраняем…" : "Сохранить отметки"}
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
