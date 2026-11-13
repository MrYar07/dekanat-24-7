"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { NOTE_MAX } from "@/lib/achievements";
import type { DecisionFormState } from "../actions";

const OPTION = {
  approved: {
    label: "Засчитать",
    hint: "Необязательно. Студент увидит комментарий рядом с достижением.",
    placeholder: "Например: засчитано как региональный уровень",
    submit: "Засчитать баллы",
  },
  rejected: {
    label: "Отклонить",
    hint: "Причина обязательна: студент увидит её в уведомлении и в списке достижений.",
    placeholder: "Причина отказа",
    submit: "Отклонить достижение",
  },
} as const;
type Choice = keyof typeof OPTION;

export function DecisionForm({
  action,
  maxPoints,
  bonusPerPoint,
  room,
}: {
  action: (prev: DecisionFormState, form: FormData) => Promise<DecisionFormState>;
  maxPoints: number;
  /** Сколько рейтинга даёт один балл. */
  bonusPerPoint: number;
  /** Сколько баллов у студента ещё пойдёт в рейтинг до предела триместра. */
  room: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [choice, setChoice] = useState<Choice>(state.decision === "rejected" ? "rejected" : "approved");
  const [points, setPoints] = useState(state.points ?? "");
  const o = OPTION[choice];

  const n = /^\d+$/.test(points.trim()) ? Number(points) : null;
  const one = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
  const effect =
    n === null || n < 1 || n > maxPoints
      ? `Целое число от 1 до ${maxPoints}: это максимум за такой вид достижения.`
      : `В рейтинг студента пойдёт +${one.format(Math.min(n, room) * bonusPerPoint)}.${n > room ? ` Предел триместра почти выбран: считаются только ${room} из ${n}.` : ""}`;

  return (
    <form
      action={formAction}
      // Отправляем сами, чтобы React не сбрасывал форму после ошибки.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
      noValidate
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Решение</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(OPTION) as Choice[]).map((c) => (
            <label
              key={c}
              className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm has-[:focus-visible]:outline-2 ${
                choice === c
                  ? c === "rejected"
                    ? "border-danger bg-danger-soft text-danger font-semibold"
                    : "border-brand bg-brand-soft text-brand font-semibold"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              <input
                type="radio"
                name="decision"
                value={c}
                checked={choice === c}
                onChange={() => setChoice(c)}
                className="sr-only"
              />
              {OPTION[c].label}
            </label>
          ))}
        </div>
      </fieldset>

      {choice === "approved" && (
        <div>
          <label htmlFor="decision-points" className="block text-sm font-medium">
            Баллы
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="decision-points"
              name="points"
              inputMode="numeric"
              autoComplete="off"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              aria-describedby="decision-points-hint"
              className="border-border bg-surface focus:border-brand block w-24 rounded-lg border px-3.5 py-3 text-base tabular-nums outline-none"
            />
            <span className="text-muted text-sm">из {maxPoints}</span>
            <Button variant="ghost" className="px-2.5 py-1.5 text-sm" onClick={() => setPoints(String(maxPoints))}>
              Максимум
            </Button>
          </div>
          <p id="decision-points-hint" className="text-muted mt-1 text-sm">
            {effect}
          </p>
        </div>
      )}

      <div>
        <label htmlFor="decision-note" className="block text-sm font-medium">
          Комментарий для студента
        </label>
        <textarea
          id="decision-note"
          name="note"
          rows={2}
          maxLength={NOTE_MAX}
          defaultValue={state.note}
          placeholder={o.placeholder}
          aria-describedby="decision-note-hint"
          className="border-border bg-surface focus:border-brand mt-1 block w-full rounded-lg border px-3.5 py-3 text-base outline-none"
        />
        <p id="decision-note-hint" className="text-muted mt-1 text-sm">
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
