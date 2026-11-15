import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, ChevronLeft, Target } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { FilterChip, FilterChips } from "@/components/ui/filter-chips";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { EmptyState } from "@/components/ui/states";
import { Stamp, StatusBadge, type StatusTone } from "@/components/ui/status";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getAchievementKinds } from "@/lib/data/achievements";
import { getGrades } from "@/lib/data/learning";
import { pathToGoal, type Effort, type PathOption } from "@/lib/grading/path";

export const metadata: Metadata = { title: "Путь к цели" };

const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const plural = (n: number, forms: [string, string, string]) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  return a > 10 && a < 20 ? forms[2] : b === 1 ? forms[0] : b > 1 && b < 5 ? forms[1] : forms[2];
};
const points = (n: number) => `${n} ${plural(n, ["балл", "балла", "баллов"])}`;

const EFFORT: Record<Effort, { tone: StatusTone; label: string }> = {
  easy: { tone: "ok", label: "по силам" },
  medium: { tone: "warn", label: "с усилием" },
  hard: { tone: "neutral", label: "на пределе" },
};
const SHORT: Record<string, string> = {
  scholarship: "Стипендия",
  top: "В числе лучших",
  grant25: "Грант 25%",
  grant50: "Грант 50%",
};

export default async function GoalPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const [g, { goal: key }, kinds] = await Promise.all([getGrades(), searchParams, getAchievementKinds()]);
  const s = g.settings;
  const back = (
    <Link href="/grades" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
      <ChevronLeft className="size-4" aria-hidden="true" />
      Успеваемость
    </Link>
  );

  const goals = g.privileges;
  // По умолчанию — ближайшая цель, до которой ещё не дошёл; если всё взято — старшая.
  const goal = goals.find((p) => p.key === key) ?? goals.find((p) => !p.reached) ?? goals[goals.length - 1];
  const courses = g.courses.map((c) => ({
    input: c.input,
    pending: c.checkpoints.filter((cp) => cp.score === null).map((cp) => cp.number),
  }));
  const path = goal ? pathToGoal(courses, g.activityPoints, goal, s) : null;

  if (!goal || !path) {
    return (
      <>
        {back}
        <PageTitle>Путь к цели</PageTitle>
        <EmptyState icon={Target} title="Считать пока не из чего">
          План появится после первого среза.
        </EmptyState>
      </>
    );
  }

  const name = (i: number) => g.courses[i].discipline;
  const basis = goal.basis === "rating" ? "по рейтингу триместра" : "по среднему баллу, без бонусов и пересдач";
  const { delta } = path.uniform;
  const alone = path.options.filter((o) => o.reaches);
  const partial = path.options.filter((o) => !o.reaches).slice(0, 3);

  const option = (o: PathOption) => {
    if (o.kind === "activity") {
      const fit = kinds.filter((k) => k.maxPoints >= o.points).sort((a, b) => a.maxPoints - b.maxPoints)[0];
      if (!o.reaches) {
        return { title: `Достижения: все оставшиеся ${points(o.room)}`, note: "", badge: null };
      }
      return {
        title: `Достижения — ещё ${points(o.points)}`,
        note: fit
          ? `Хватит одного: например, «${fit.name.toLowerCase()}» (до ${fit.maxPoints}).`
          : `Понадобится несколько достижений. В рейтинг пойдёт ещё не больше ${o.room}.`,
        badge: null,
      };
    }
    const c = g.courses[o.course];
    const pending = courses[o.course].pending;
    if (!o.reaches) {
      const what = o.kind === "exam" ? "экзамен" : pending.length === 1 ? `срез ${pending[0]}` : "оставшиеся срезы";
      return { title: `${c.discipline}: ${what} на 100`, note: "", badge: null };
    }
    const title =
      o.kind === "exam"
        ? `Экзамен — ${o.score} и больше`
        : pending.length === 1
          ? `Срез ${pending[0]} — ${o.score} и больше`
          : `Оставшиеся ${pending.length} среза — в среднем ${o.score} и больше`;
    const up = o.score - o.level;
    const now = o.kind === "exam" ? `в прогнозе сейчас ${o.level}` : `твой средний за срезы ${o.level}`;
    return {
      title: `${c.discipline}: ${title[0].toLowerCase()}${title.slice(1)}`,
      note: up > 0 ? `${now[0].toUpperCase()}${now.slice(1)}, нужно на ${points(up)} выше.` : `${now[0].toUpperCase()}${now.slice(1)}: этого уже хватает.`,
      badge: EFFORT[o.effort],
    };
  };

  return (
    <>
      {back}
      <PageTitle
        hint="Кабинет сам подбирает, что получить на оставшихся срезах и экзаменах, чтобы выйти на порог. Считает по тем же правилам, что и рейтинг."
      >
        Путь к цели
      </PageTitle>

      <div className="mb-5">
        <FilterChips label="Цель">
          {goals.map((p) => (
            <FilterChip
              key={p.key}
              href={`/grades/goal?goal=${p.key}`}
              active={p.key === goal.key}
              label={`${SHORT[p.key] ?? p.label}${p.reached ? " ✓" : ""}`}
            />
          ))}
        </FilterChips>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card aria-label="Цель" className="self-start">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted font-serif text-sm italic">цель</p>
              <p className="mt-1 font-serif text-xl leading-snug font-bold">{goal.label[0].toUpperCase() + goal.label.slice(1)}</p>
            </div>
            {path.reached && <Stamp>есть</Stamp>}
          </div>
          <Ledger className="mt-4">
            <LedgerRow label="Порог" value={one.format(goal.from)} note={goal.basis === "rating" ? "рейтинг" : "средний балл"} />
            <LedgerRow label="Сейчас" value={one.format(path.value)} />
            {path.reached ? (
              <LedgerRow label="Запас" value={`+${one.format(path.value - goal.from)}`} />
            ) : (
              <LedgerRow label="Не хватает" value={one.format(path.gap)} />
            )}
          </Ledger>
          <p className="text-muted mt-3 text-xs">
            Порог считается {basis}. До сессии это прогноз: вместо экзамена подставлена работа в триместре.
          </p>
        </Card>

        <section aria-labelledby="even-title">
          <SectionTitle>
            <span id="even-title">{path.reached ? "Как не потерять" : "Ровный план"}</span>
          </SectionTitle>
          {delta === null ? (
            <Callout tone="info" lead="В этом триместре не дотянуть.">
              Даже с сотнями на всём, что осталось, выйдет {one.format(path.uniform.best)} при пороге {one.format(goal.from)}. Выбери цель
              ближе или смотри отдельные ходы ниже.
            </Callout>
          ) : (
            <>
              <p className="text-sm">
                {path.reached ? (
                  delta <= -100 ? (
                    <>Цель уже не потерять: её хватает при любых оставшихся оценках.</>
                  ) : delta < 0 ? (
                    <>
                      Цель удержится, даже если на всём, что осталось, получать <b>на {points(-delta)} ниже</b> своего нынешнего среднего.
                      Ниже — граница по каждой дисциплине.
                    </>
                  ) : (
                    <>
                      Запаса нет: цель держится, только если на всём, что осталось, получать <b>не ниже своего нынешнего среднего</b>.
                    </>
                  )
                ) : delta <= 0 ? (
                  <>
                    Хватит нынешнего уровня: получай на всём, что осталось, <b>не ниже своего среднего</b> — и цель твоя.
                  </>
                ) : (
                  <>
                    Получай на всём, что осталось, <b>на {points(delta)} выше</b> своего нынешнего среднего по каждой дисциплине — и цель
                    твоя.
                  </>
                )}
              </p>
              {delta > -100 && (
                <ul className="divide-border border-border mt-3 divide-y rounded-xl border text-sm">
                  {path.uniform.targets.map((t) => (
                    <li key={t.course} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
                      <span className="min-w-0">{name(t.course)}</span>
                      <span className="shrink-0 text-right tabular-nums">
                        {t.checkpoints !== null && (
                          <span className="block">
                            {courses[t.course].pending.length === 1 ? `срез ${courses[t.course].pending[0]}` : "срезы"}:{" "}
                            <b className="font-serif text-base">{t.checkpoints}</b>
                          </span>
                        )}
                        {t.exam !== null && (
                          <span className="block">
                            экзамен: <b className="font-serif text-base">{t.exam}</b>
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      {!path.reached && (
        <section aria-labelledby="single-title" className="mt-8">
          <SectionTitle>
            <span id="single-title">Или один сильный ход</span>
          </SectionTitle>
          {alone.length === 0 ? (
            <p className="text-sm">Одного хода не хватит: до цели далеко. Самое весомое из того, что есть:</p>
          ) : (
            <p className="text-muted text-sm">Каждого из них хватает в одиночку, если остальное останется как сейчас. От лёгкого к трудному.</p>
          )}
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {(alone.length > 0 ? alone.slice(0, 6) : partial).map((o, i) => {
              const v = option(o);
              return (
                <li key={i} className="border-border bg-surface rounded-xl border p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold">{v.title}</p>
                    {o.reaches && v.badge && (
                      <span className="shrink-0">
                        <StatusBadge tone={v.badge.tone}>{v.badge.label}</StatusBadge>
                      </span>
                    )}
                  </div>
                  <p className="text-muted mt-1 text-sm">
                    {o.reaches
                      ? v.note
                      : `Даже максимум даст +${one.format(o.gain)} из нужных ${one.format(path.gap)}.`}
                  </p>
                  {o.kind === "activity" && (
                    <Link href="/grades/achievements/new" className="text-brand mt-2 inline-block text-sm font-semibold hover:underline">
                      Добавить достижение
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Link href="/grades/what-if" className={buttonClass("secondary", "mt-8 w-full text-sm sm:w-auto")}>
        <Calculator className="size-4" aria-hidden="true" />
        Проверить свой вариант в калькуляторе
      </Link>
    </>
  );
}
