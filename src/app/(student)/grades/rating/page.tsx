import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, TrendingUp } from "lucide-react";
import { StepLine } from "@/components/charts/step-line";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getGrades } from "@/lib/data/learning";
import { explainDiscipline, MARK_LABEL, markFor, ratingBySteps, type DisciplineBreakdown, type GradingSettings } from "@/lib/grading";

export const metadata: Metadata = { title: "Из чего мой рейтинг" };

const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const pct = (weight: number) => `${whole.format(weight * 100)}%`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${one.format(Math.abs(n))}`;

function plural(n: number, forms: [string, string, string]) {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? forms[0] : d >= 2 && d <= 4 && (h < 12 || h > 14) ? forms[1] : forms[2];
}

/** Разбор одной дисциплины простыми словами. */
function story(b: DisciplineBreakdown): string {
  const work = one.format(b.work.value);
  const score = one.format(b.score);
  const session = b.session.kind === "exam" ? "экзамен" : "зачёт";
  const attendance =
    b.engagement.attendancePct !== null ? ` С посещаемостью ${whole.format(b.engagement.attendancePct)}% выходит ${score}.` : ` Выходит ${score}.`;

  if (b.session.mode === "auto") {
    return `За работу в триместре ${work} — этого хватает на автомат: зачёт ставится с тем же баллом.${attendance}`;
  }
  if (b.session.mode === "forecast") {
    return `За работу в триместре ${work}. ${session === "экзамен" ? "Экзамена" : "Зачёта"} ещё не было, поэтому пока вместо него считается тот же балл.${attendance}`;
  }
  const taken = one.format(b.session.value);
  const link = b.session.value - b.work.value >= 5 || b.work.value - b.session.value >= 5 ? "но" : "и";
  return `За ${session} ${taken}, ${link} за работу в триместре ${work}, поэтому дисциплина — ${score}.`;
}

/** Строка части: название и вес, из чего получилась, вклад и полоса «сколько взято из возможного». */
function Part({ name, weight, share, detail }: { name: string; weight: number; share: { value: number; points: number }; detail: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-medium">
          {name} <span className="text-muted font-normal">· {pct(weight)}</span>
        </p>
        <p className="shrink-0 tabular-nums">
          <b className="font-serif text-[17px]">{one.format(share.points)}</b>
          <span className="text-muted text-xs"> из {whole.format(weight * 100)}</span>
        </p>
      </div>
      <p className="text-muted mt-0.5 text-xs">{detail}</p>
      {/* Полоса: балл части из 100. Скруглён только конец с данными, начало — от ровной базовой линии. */}
      <div className="bg-surface-2 mt-1.5 h-2 rounded-r" role="presentation">
        <div className="bg-brand h-2 rounded-r" style={{ width: `${Math.max(0, Math.min(100, share.value))}%` }} />
      </div>
    </div>
  );
}

function workDetail(b: DisciplineBreakdown, scores: number[]) {
  const list = scores.join(", ");
  const base = scores.length === 1 ? `срез: ${list}` : `срезы: ${list} → среднее ${one.format(b.work.mean)}`;
  return b.work.bonus > 0 ? `${base}, бонус преподавателя +${b.work.bonus} = ${one.format(b.work.value)}` : base;
}

function sessionDetail(b: DisciplineBreakdown, s: GradingSettings) {
  const name = b.session.kind === "exam" ? "экзамен" : "зачёт";
  if (b.session.mode === "auto") return `автомат: работа в триместре от ${s.autoCreditFrom}, балл тот же — ${one.format(b.session.value)}`;
  if (b.session.mode === "forecast") return `${name} впереди, пока считается балл за работу — ${one.format(b.session.value)}`;
  const notes = [];
  if (b.session.capped) notes.push(`без автомата не выше ${s.creditCapWithoutAuto}`);
  if (b.session.penalty > 0) notes.push(`${b.session.retakes} ${plural(b.session.retakes, ["пересдача", "пересдачи", "пересдач"])}: −${b.session.penalty}`);
  return `${name}: ${b.session.raw}${notes.length ? `, ${notes.join(", ")} → ${one.format(b.session.value)}` : ""}`;
}

function engagementDetail(b: DisciplineBreakdown) {
  const e = b.engagement;
  if (e.mode === "both") return `посещаемость ${whole.format(e.attendancePct!)}% и активность на занятиях ${whole.format(e.activity!)} — пополам`;
  if (e.mode === "attendance") return `посещаемость ${whole.format(e.attendancePct!)}%; активность преподаватель оценит в конце триместра`;
  if (e.mode === "activity") return `активность на занятиях ${whole.format(e.activity!)}; отметок посещаемости пока нет`;
  return "отметок пока нет, считается как работа в триместре";
}

export default async function RatingBreakdownPage() {
  const g = await getGrades();
  const s = g.settings;
  const r = g.rating;

  const rows = g.courses
    .map((c) => ({ c, b: explainDiscipline(c.input, s) }))
    .filter((x): x is { c: (typeof g.courses)[number]; b: DisciplineBreakdown } => x.b !== null);

  const back = (
    <Link href="/grades" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
      <ChevronLeft className="size-4" aria-hidden="true" />
      Успеваемость
    </Link>
  );

  if (!r || rows.length === 0) {
    return (
      <>
        {back}
        <PageTitle>Из чего мой рейтинг</PageTitle>
        <EmptyState icon={TrendingUp} title="Разбирать пока нечего">
          Рейтинг появится после первого среза. Тогда здесь будет видно, из чего он сложился.
        </EmptyState>
      </>
    );
  }

  const sorted = [...rows].sort((a, b) => b.b.score - a.b.score);
  const steps = ratingBySteps(
    g.courses.map((c) => c.input),
    g.activityPoints,
    s,
  );
  const allScores = g.courses.flatMap((c) => c.checkpoints.flatMap((cp) => (cp.score === null ? [] : [cp.score])));
  // Общая шкала для всех графиков срезов: от круглого числа чуть ниже минимума до 100.
  const domain: [number, number] = [Math.max(0, Math.floor((Math.min(...allScores) - 5) / 10) * 10), 100];
  const stepDomain: [number, number] = [Math.max(0, Math.floor((Math.min(...steps.map((x) => x.rating)) - 5) / 10) * 10), 100];
  const perPoint = 1 / rows.length;

  return (
    <>
      {back}
      <PageTitle
        eyebrow={g.term ? `${g.term.name}${r.forecast ? " · прогноз" : ""}` : undefined}
        hint="Три шага: балл каждой дисциплины, средний балл, бонус активности. Все числа — те же, что видит деканат."
      >
        Из чего мой рейтинг
      </PageTitle>

      {/* Итог одной строкой: средний балл + бонус = рейтинг. */}
      <Card aria-label="Итог" className="mb-8">
        {/* Сложение столбиком, как в ведомости: на телефоне знаки не «повисают» между строками. */}
        <dl className="grid w-fit grid-cols-[auto_auto_1fr] items-baseline gap-x-3 gap-y-1.5">
          <span aria-hidden="true" />
          <dd className="text-right font-serif text-2xl font-bold tabular-nums">{one.format(r.base)}</dd>
          <dt className="text-muted text-sm">
            средний балл по {rows.length} {plural(rows.length, ["дисциплине", "дисциплинам", "дисциплинам"])}
          </dt>
          <span className="text-muted font-serif text-xl" aria-label="плюс">
            +
          </span>
          <dd className="text-right font-serif text-2xl font-bold tabular-nums">{one.format(r.bonus)}</dd>
          <dt className="text-muted text-sm">бонус активности</dt>
          <span aria-hidden="true" className="border-text col-span-2 border-t-2" />
          <span aria-hidden="true" />
          <span className="text-muted font-serif text-xl" aria-label="равно">
            =
          </span>
          <dd className="text-right font-serif text-[40px] leading-none font-bold tabular-nums">{one.format(r.rating)}</dd>
          <dt className="text-muted text-sm">рейтинг триместра{r.forecast ? ", прогноз" : ""}</dt>
        </dl>
        {r.forecast && (
          <p className="text-muted mt-4 text-xs">
            Прогноз: сессии ещё не было, поэтому вместо экзаменов и зачётов пока считаются баллы за работу в триместре.
            После сессии числа изменятся.
          </p>
        )}
      </Card>

      <section aria-labelledby="step1-title" className="mb-8">
        <SectionTitle>
          <span id="step1-title">Шаг 1. Балл каждой дисциплины</span>
        </SectionTitle>
        <p className="text-muted mb-4 text-sm">
          Балл дисциплины складывается из трёх частей: работа в триместре — {pct(s.weights.work)}, сессия —{" "}
          {pct(s.weights.session)}, вовлечённость — {pct(s.weights.engagement)}. Полоса показывает, сколько взято из
          возможного в каждой части.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ c, b }) => (
            <Card key={c.id} aria-labelledby={`d-${c.id}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 id={`d-${c.id}`} className="min-w-0 font-serif text-lg leading-snug font-bold">
                  {c.discipline}
                </h3>
                {/* «Прогноз» отдельной строкой: «удовлетворительно, прогноз» в одну не помещается рядом с длинным названием. */}
                <div className="shrink-0 text-right">
                  <p className="font-serif text-2xl leading-none font-bold tabular-nums">{one.format(b.score)}</p>
                  <p className="text-muted mt-1 text-xs">{MARK_LABEL[markFor(b.score, s)]}</p>
                  {b.forecast && <p className="text-muted text-xs">прогноз</p>}
                </div>
              </div>
              <p className="mt-2 text-sm">{story(b)}</p>
              <div className="mt-4 space-y-3.5">
                <Part
                  name="Работа в триместре"
                  weight={b.work.weight}
                  share={b.work}
                  detail={workDetail(
                    b,
                    c.checkpoints.flatMap((cp) => (cp.score === null ? [] : [cp.score])),
                  )}
                />
                <Part name="Сессия" weight={b.session.weight} share={b.session} detail={sessionDetail(b, s)} />
                <Part name="Вовлечённость" weight={b.engagement.weight} share={b.engagement} detail={engagementDetail(b)} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="step2-title" className="mb-8">
        <SectionTitle>
          <span id="step2-title">Шаг 2. Средний балл</span>
        </SectionTitle>
        <p className="text-muted mb-4 text-sm">
          Все дисциплины весят одинаково. Среднее — <b className="text-text">{one.format(r.base)}</b>, на полосах оно
          отмечено чертой. {whole.format(1 / perPoint)} {plural(Math.round(1 / perPoint), ["балл", "балла", "баллов"])} в
          одной дисциплине — это 1 балл рейтинга.
        </p>
        <ul className="space-y-3">
          {sorted.map(({ c, b }) => (
            <li key={c.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{c.discipline}</span>
                <span className="shrink-0 tabular-nums">
                  <b className="font-serif text-[17px]">{one.format(b.score)}</b>
                  <span className="text-muted ml-1.5 text-xs">{signed(b.score - r.base)} к среднему</span>
                </span>
              </div>
              <div className="bg-surface-2 relative mt-1 h-2 rounded-r">
                <div className="bg-brand h-2 rounded-r" style={{ width: `${Math.min(100, b.score)}%` }} title={`${c.discipline}: ${one.format(b.score)}`} />
                {/* Черта среднего балла: одна и та же позиция на всех полосах. */}
                <span aria-hidden="true" className="bg-text absolute -top-1 h-4 w-0.5" style={{ left: `${Math.min(100, r.base)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="step3-title" className="mb-8">
        <SectionTitle>
          <span id="step3-title">Шаг 3. Бонус активности</span>
        </SectionTitle>
        <p className="text-sm">
          Подтверждённые достижения: <b>{g.activityPoints}</b> {plural(g.activityPoints, ["балл", "балла", "баллов"])} из{" "}
          {s.activityPointsMax}. В рейтинг идёт {pct(s.activityCoefficient)} от них: {g.activityPoints} ×{" "}
          {String(s.activityCoefficient).replace(".", ",")} = <b>+{one.format(r.bonus)}</b>. Максимум — +
          {one.format(s.activityPointsMax * s.activityCoefficient)}.
        </p>
        <p className="text-muted mt-2 text-sm">
          Бонус прибавляется к рейтингу триместра, а в годовой рейтинг и гранты не идёт.{" "}
          <Link href="/grades#achievements-title" className="text-brand font-semibold hover:underline">
            Мои достижения
          </Link>
        </p>
      </section>

      <section aria-labelledby="dynamics-title">
        <SectionTitle>
          <span id="dynamics-title">Как срезы меняли картину</span>
        </SectionTitle>
        {steps.length > 0 && (
          <Card className="mb-4" aria-label="Прогноз рейтинга по срезам">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="min-w-0 flex-1 basis-44">
                <p className="font-semibold">Прогноз рейтинга</p>
                <p className="text-muted mt-1 text-sm">
                  {steps.length > 1
                    ? `После первого среза — ${one.format(steps[0].rating)}, сейчас — ${one.format(steps.at(-1)!.rating)} (${signed(steps.at(-1)!.rating - steps[0].rating)}).`
                    : `Пока один срез: ${one.format(steps[0].rating)}. После следующего здесь появится линия.`}
                </p>
                <p className="text-muted mt-1 text-xs">Посещаемость и бонусы взяты сегодняшние: видно влияние именно срезов.</p>
              </div>
              <div className="w-full max-w-60 shrink-0 basis-44">
                <StepLine
                  title="Прогноз рейтинга по срезам"
                  domain={stepDomain}
                  width={220}
                  height={84}
                  decimals={1}
                  points={steps.map((x) => ({ label: `срез ${x.after}`, value: x.rating }))}
                />
              </div>
            </div>
          </Card>
        )}
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {rows.map(({ c }) => {
            const graded = c.checkpoints.filter((cp) => cp.score !== null);
            const delta = graded.length > 1 ? graded.at(-1)!.score! - graded[0].score! : null;
            return (
              <li key={c.id} className="border-border bg-surface rounded-xl border p-3">
                {/* Две строки под название: длинные дисциплины не обрезаются, графики в ряду стоят на одной высоте. */}
                <p className="min-h-10 text-sm leading-5 font-medium">{c.discipline}</p>
                <p className="text-muted text-xs tabular-nums">{delta === null ? "один срез" : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${Math.abs(delta)} за срезы`}</p>
                <div className="mt-1">
                  <StepLine
                    title={c.discipline}
                    domain={domain}
                    points={c.checkpoints.map((cp) => ({ label: `ср. ${cp.number}`, value: cp.score }))}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-muted mt-3 text-xs">
          Шкала на всех графиках одна, от {domain[0]} до 100: по высоте точек дисциплины можно сравнивать между собой.
        </p>
      </section>
    </>
  );
}
