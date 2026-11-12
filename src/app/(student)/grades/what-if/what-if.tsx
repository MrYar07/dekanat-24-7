"use client";

import { useMemo, useState } from "react";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MARK_LABEL, markFor, type DisciplineInput, type GradingSettings } from "@/lib/grading";
import { EMPTY_SCENARIO, isEmptyScenario, whatIf, type CourseScenario } from "@/lib/grading/scenario";

export type WhatIfCourseProp = {
  id: string;
  discipline: string;
  assessment: "exam" | "credit";
  input: DisciplineInput;
  /** Срезы, по которым балла ещё нет. */
  pending: { number: number; week: number }[];
};

const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0.049 ? "+" : n < -0.049 ? "−" : "±"}${one.format(Math.abs(n))}`;

/** Ползунок предполагаемого балла. null — предположение не задано, в расчёте не участвует. */
function ScoreSlider({
  id,
  label,
  hint,
  value,
  start,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number | null;
  /** Где стоит бегунок, пока значение не задано. */
  start: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <output htmlFor={id} className={`shrink-0 tabular-nums ${value === null ? "text-muted text-sm" : "font-serif text-lg font-bold"}`}>
          {value === null ? "не задано" : value}
        </output>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value ?? start}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={value === null ? "не задано" : `${value} из 100`}
          className={`accent-brand h-6 min-w-0 flex-1 ${value === null ? "opacity-60" : ""}`}
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={value === null}
          aria-label={`Убрать: ${label}`}
          className="text-muted hover:text-text -mr-1.5 rounded p-1.5 disabled:invisible"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}

export function WhatIf({
  courses,
  activityPoints,
  settings: s,
  isPaid,
}: {
  courses: WhatIfCourseProp[];
  activityPoints: number;
  settings: GradingSettings;
  isPaid: boolean;
}) {
  const [scenarios, setScenarios] = useState<Record<string, CourseScenario>>({});
  const [activity, setActivity] = useState<number | null>(null);

  const of = (id: string) => scenarios[id] ?? EMPTY_SCENARIO;
  const patch = (id: string, change: (sc: CourseScenario) => CourseScenario) =>
    setScenarios((all) => ({ ...all, [id]: change(all[id] ?? EMPTY_SCENARIO) }));

  const result = useMemo(
    () =>
      whatIf(
        courses.map((c) => ({ input: c.input, scenario: scenarios[c.id] ?? EMPTY_SCENARIO })),
        { now: activityPoints, then: activity ?? activityPoints },
        isPaid,
        s,
      ),
    [courses, scenarios, activity, activityPoints, isPaid, s],
  );

  const touched = activity !== null || courses.some((c) => !isEmptyScenario(of(c.id)));
  const before = result.before;
  const after = result.after;
  if (!before || !after) return null;
  const delta = after.rating - before.rating;

  return (
    <>
      {/* Итог всегда на виду: прилипает к верху, пока листаешь дисциплины. */}
      <div className="bg-bg sticky top-0 z-10 -mx-4 mb-6 px-4 py-2 md:mx-0 md:px-0">
        <Card aria-label="Рейтинг в сценарии" className="py-3!">
          <div className="flex items-center justify-between gap-3">
            <div role="status" aria-live="polite" className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {touched && (
                <>
                  <span className="text-muted font-serif text-xl font-bold tabular-nums">{one.format(before.rating)}</span>
                  <ArrowRight className="text-muted size-4 self-center" aria-label="станет" />
                </>
              )}
              <span className="font-serif text-[32px] leading-none font-bold tabular-nums">{one.format(after.rating)}</span>
              <span className="text-sm font-semibold tabular-nums">{touched ? signed(delta) : "рейтинг сейчас"}</span>
            </div>
            <Button
              variant="ghost"
              className="-mr-2 shrink-0 px-2 py-1.5 text-sm"
              disabled={!touched}
              onClick={() => {
                setScenarios({});
                setActivity(null);
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Сбросить
            </Button>
          </div>
          {(result.gained.length > 0 || result.lost.length > 0) && (
            <p className="mt-2 text-sm">
              {result.gained.length > 0 && (
                <span>
                  Хватит на: <b>{result.gained.map((p) => p.label).join(", ")}</b>.{" "}
                </span>
              )}
              {result.lost.length > 0 && (
                <span>
                  Уже не хватит на: <b>{result.lost.map((p) => p.label).join(", ")}</b>.
                </span>
              )}
            </p>
          )}
          {!touched && <p className="text-muted mt-1 text-xs">Подвигай ползунки ниже — число пересчитается сразу.</p>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {courses.map((c, i) => {
          const sc = of(c.id);
          const r = result.courses[i];
          const now = r.before;
          const then = r.after;
          const changed = now && then && Math.abs(then.score - now.score) > 0.049;
          const sessionName = c.assessment === "exam" ? "экзамен" : "зачёт";
          // Автомат по зачёту: сессию сдавать не нужно, ползунок выключен.
          const auto = then?.session.auto ?? false;

          return (
            <Card key={c.id} aria-labelledby={`w-${c.id}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 id={`w-${c.id}`} className="min-w-0 font-serif text-lg leading-snug font-bold">
                  {c.discipline}
                </h3>
                {then && (
                  <div className="shrink-0 text-right">
                    <p className="font-serif text-2xl leading-none font-bold tabular-nums">{one.format(then.score)}</p>
                    <p className="text-muted mt-1 text-xs">
                      {changed && now ? `было ${one.format(now.score)}, ${signed(then.score - now.score)}` : MARK_LABEL[markFor(then.score, s)]}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-4">
                {c.pending.map((cp) => (
                  <ScoreSlider
                    key={cp.number}
                    id={`cp-${c.id}-${cp.number}`}
                    label={`Срез ${cp.number}`}
                    hint={`${cp.week}-я неделя`}
                    value={sc.checkpoints[cp.number] ?? null}
                    start={Math.round(now?.work ?? 75)}
                    onChange={(v) =>
                      patch(c.id, (x) => {
                        const next = { ...x.checkpoints };
                        if (v === null) delete next[cp.number];
                        else next[cp.number] = v;
                        return { ...x, checkpoints: next };
                      })
                    }
                  />
                ))}

                {auto ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">Зачёт</p>
                    <p className="text-right text-sm">
                      <b>автомат</b>
                      <span className="text-muted block text-xs">работа в триместре от {s.autoCreditFrom}, сдавать не нужно</span>
                    </p>
                  </div>
                ) : (
                  <ScoreSlider
                    id={`session-${c.id}`}
                    label={sessionName[0].toUpperCase() + sessionName.slice(1)}
                    hint={
                      c.assessment === "credit"
                        ? `Без автомата за зачёт ставят не больше ${s.creditCapWithoutAuto}.`
                        : sc.session === null
                          ? "Пока вместо экзамена считается балл за работу в триместре."
                          : undefined
                    }
                    value={sc.session}
                    start={Math.round(then?.work ?? 75)}
                    onChange={(v) => patch(c.id, (x) => ({ ...x, session: v, retakes: v === null ? 0 : x.retakes }))}
                  />
                )}

                {sc.session !== null && !auto && (
                  <fieldset>
                    <legend className="text-sm font-medium">Пересдачи</legend>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {[0, 1, 2].map((n) => (
                        <label
                          key={n}
                          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm tabular-nums has-[:focus-visible]:outline-2 ${
                            sc.retakes === n ? "border-brand bg-brand-soft text-brand font-semibold" : "border-border text-muted hover:text-text"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`retakes-${c.id}`}
                            value={n}
                            checked={sc.retakes === n}
                            onChange={() => patch(c.id, (x) => ({ ...x, retakes: n }))}
                            className="sr-only"
                          />
                          {n === 0 ? "с первого раза" : n === 1 ? "одна" : "две"}
                        </label>
                      ))}
                    </div>
                    <p className="text-muted mt-1 text-xs">
                      Каждая пересдача снимает {s.retakePenalty} баллов с оценки
                      {sc.retakes > 0 && then ? `: в зачёт пойдёт ${one.format(then.session.score)}` : ""}.
                    </p>
                  </fieldset>
                )}
              </div>
            </Card>
          );
        })}

        <Card aria-labelledby="w-activity">
          <div className="flex items-start justify-between gap-3">
            <h3 id="w-activity" className="font-serif text-lg leading-snug font-bold">
              Бонус активности
            </h3>
            <div className="shrink-0 text-right">
              <p className="font-serif text-2xl leading-none font-bold tabular-nums">+{one.format(after.bonus)}</p>
              <p className="text-muted mt-1 text-xs">
                {activity !== null && activity !== activityPoints ? `было +${one.format(before.bonus)}` : "к рейтингу"}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <ScoreSlider
              id="activity"
              label="Баллы за достижения"
              hint={`Сейчас подтверждено ${activityPoints} из ${s.activityPointsMax}. В рейтинг идёт ${Math.round(s.activityCoefficient * 100)}% от них.`}
              value={activity}
              start={activityPoints}
              onChange={setActivity}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
