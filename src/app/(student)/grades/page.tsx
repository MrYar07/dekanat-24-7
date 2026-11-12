import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Check, Circle, FileText, TrendingUp } from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { Stamp, StatusBadge } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getGrades } from "@/lib/data/learning";
import { MARK_LABEL, markFor, neededOnExam, neededOnRemainingCheckpoints, type GradingSettings } from "@/lib/grading";

export const metadata: Metadata = { title: "Успеваемость" };

const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

type Course = Awaited<ReturnType<typeof getGrades>>["courses"][number];

/** Подсказка «что нужно, чтобы…» по одной дисциплине. null — подсказывать нечего. */
function hint(c: Course, s: GradingSettings): { lead: string; text: string } | null {
  const graded = c.checkpoints.filter((cp) => cp.score !== null).map((cp) => cp.score!);
  const remaining = c.plannedCheckpoints - graded.length;
  const nextCp = c.checkpoints.find((cp) => cp.score === null);

  if (c.assessment === "credit") {
    const n = neededOnRemainingCheckpoints(graded, c.plannedCheckpoints, s.autoCreditFrom, c.bonus, s);
    if (n.kind === "already") {
      return { lead: "Автомат обеспечен.", text: `Зачёт поставят без сдачи, даже если оставшиеся срезы не пойдут.` };
    }
    if (n.kind === "need" && remaining > 0) {
      return {
        lead: "До автомата:",
        text: `${remaining === 1 ? `на срезе ${nextCp?.number}` : `в среднем на оставшихся ${remaining} срезах`} нужно ${n.score} и больше. Без автомата за зачёт можно получить не больше ${s.creditCapWithoutAuto}.`,
      };
    }
    return { lead: "Автомата не будет.", text: `Готовься к зачёту: за него можно получить до ${s.creditCapWithoutAuto} баллов.` };
  }

  if (!c.result) return null;
  const target = s.thresholds.excellent;
  const n = neededOnExam(c.result.work, c.result.engagement, target, c.retakes, s);
  if (n.kind === "need") {
    return {
      lead: "Для «отлично»",
      text: `по дисциплине нужно ${n.score} и больше на экзамене при нынешних срезах и посещаемости.`,
    };
  }
  if (n.kind === "already") return { lead: "«Отлично» почти в кармане:", text: "хватит даже скромного экзамена." };
  const good = neededOnExam(c.result.work, c.result.engagement, s.thresholds.good, c.retakes, s);
  return good.kind === "need"
    ? { lead: "Для «хорошо»", text: `нужно ${good.score} и больше на экзамене. До «отлично» в этом триместре уже не дотянуть.` }
    : null;
}

function CourseCard({ c, s, week }: { c: Course; s: GradingSettings; week: number }) {
  const h = hint(c, s);
  const allGraded = c.checkpoints.every((cp) => cp.score !== null);
  const att = c.attendance;
  return (
    <Card aria-labelledby={`course-${c.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`course-${c.id}`} className="font-serif text-lg leading-snug font-bold">
            {c.discipline}
          </h3>
          <p className="text-muted text-sm">
            {c.teacher} · {c.assessment === "exam" ? "экзамен" : "зачёт"}
          </p>
        </div>
        {c.result && (
          <div className="shrink-0 text-right">
            <p className="font-serif text-2xl leading-none font-bold tabular-nums">{one.format(c.result.score)}</p>
            <p className="text-muted mt-1 text-xs">
              {MARK_LABEL[markFor(c.result.score, s)]}
              {c.result.forecast && ", прогноз"}
            </p>
          </div>
        )}
      </div>

      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Срезы">
        {c.checkpoints.map((cp) => (
          <li
            key={cp.number}
            className={`rounded-lg border px-2 py-1.5 text-center ${cp.score === null ? "border-border border-dashed" : "border-border bg-surface-2"}`}
          >
            <p className="text-muted text-[11px] font-semibold tracking-[0.06em] uppercase">срез {cp.number}</p>
            {cp.score === null ? (
              <p className="text-muted text-sm leading-7">{cp.week < week ? "ждём балл" : `${cp.week}-я нед.`}</p>
            ) : (
              <p className="font-serif text-xl leading-7 font-bold tabular-nums">{cp.score}</p>
            )}
          </li>
        ))}
      </ol>

      <Ledger className="mt-4">
        {c.result && (
          <LedgerRow
            label="Работа в триместре"
            value={one.format(c.result.work)}
            note={c.bonus > 0 ? `бонус +${c.bonus}` : undefined}
          />
        )}
        <LedgerRow
          label="Посещаемость"
          value={att.pct === null ? "—" : `${whole.format(att.pct)}%`}
          note={
            att.absent > 0
              ? `${att.absent} ${att.absent === 1 ? "пропуск" : att.absent < 5 ? "пропуска" : "пропусков"}`
              : att.pct !== null
                ? "без пропусков"
                : undefined
          }
        />
        {/* Автомат окончательный, только когда выставлены все срезы. До этого — подсказка ниже. */}
        {allGraded && c.result?.session.auto && <LedgerRow label="Зачёт" value="автомат" />}
      </Ledger>

      {h && (
        <div className="border-border mt-4 border-t pt-3">
          <Callout tone="info" lead={h.lead}>
            {h.text}
          </Callout>
        </div>
      )}
    </Card>
  );
}

export default async function GradesPage() {
  const g = await getGrades();
  const s = g.settings;

  if (!g.term || g.courses.length === 0) {
    return (
      <>
        <PageTitle>Успеваемость</PageTitle>
        <EmptyState icon={TrendingUp} title="Баллов пока нет">
          Как только начнётся триместр и преподаватели поставят первые срезы, они появятся здесь.
        </EmptyState>
      </>
    );
  }

  const r = g.rating;
  const approved = g.achievements.filter((a) => a.status === "approved");

  return (
    <>
      <PageTitle eyebrow={`${g.term.name} · ${Math.min(g.term.week, g.term.weeks)}-я неделя из ${g.term.weeks}`}>
        Успеваемость
      </PageTitle>

      {r && (
        <section className="mb-8 grid gap-6 sm:grid-cols-2" aria-label="Рейтинг">
          <Card>
            <p className="text-muted text-xs font-semibold tracking-[0.08em] uppercase">
              Рейтинг триместра{r.forecast && " · прогноз"}
            </p>
            <p className="mt-1 font-serif text-[44px] leading-none font-bold tabular-nums">{one.format(r.rating)}</p>
            <Ledger className="mt-4">
              <LedgerRow label="Средний балл по дисциплинам" value={one.format(r.base)} />
              <LedgerRow
                label="Бонус активности"
                value={`+${one.format(r.bonus)}`}
                note={`${g.activityPoints} из ${s.activityPointsMax}`}
              />
            </Ledger>
            {r.forecast && (
              <p className="text-muted mt-3 text-xs">
                До сессии вместо оценки за экзамен подставляется балл за работу в триместре. Так считает деканат
                «Меридиана» — подробнее в правилах оценивания.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/grades/rating" className="text-brand inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                <TrendingUp className="size-4" aria-hidden="true" />
                Из чего он складывается
              </Link>
              <Link href="/grades/what-if" className="text-brand inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                <Calculator className="size-4" aria-hidden="true" />
                А если…
              </Link>
              <Link
                href="/requests/new/rating"
                className="text-brand inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
              >
                <FileText className="size-4" aria-hidden="true" />
                Выписка рейтинга в PDF
              </Link>
            </div>
          </Card>

          <div>
            <SectionTitle>Что даёт рейтинг</SectionTitle>
            <ul className="space-y-2.5 text-sm">
              {g.privileges.map((p) => (
                <li key={p.key} className="flex items-start gap-2.5">
                  {p.reached ? (
                    <Check className="text-ok mt-0.5 size-4 shrink-0" aria-label="порог пройден" />
                  ) : (
                    <Circle className="text-muted mt-0.5 size-4 shrink-0" aria-label="порог не пройден" />
                  )}
                  <span>
                    <span className={p.reached ? "font-semibold" : ""}>{p.label}</span>
                    <span className="text-muted">
                      {" "}
                      — от {p.from}
                      {p.basis === "base" ? " по году, без бонусов и пересдач" : " по рейтингу триместра"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {g.goal && g.goal.gap > 0 && (
              <p className="mt-4 text-sm">
                До порога «{g.goal.label}» не хватает <b>{one.format(g.goal.gap)}</b>{" "}
                {g.goal.basis === "base" ? "балла по среднему без бонусов" : "балла рейтинга"}.
              </p>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="courses-title" className="mb-8">
        <SectionTitle>
          <span id="courses-title">Дисциплины</span>
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {g.courses.map((c) => (
            <CourseCard key={c.id} c={c} s={s} week={g.term!.week} />
          ))}
        </div>
      </section>

      <section aria-labelledby="achievements-title">
        <SectionTitle>
          <span id="achievements-title">Достижения триместра</span>
        </SectionTitle>
        {g.achievements.length === 0 ? (
          <p className="text-muted text-sm">
            Пока ничего. Статьи, конференции, соревнования и работа в студенческих организациях дают до +
            {one.format(s.activityPointsMax * s.activityCoefficient)} к рейтингу.
          </p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {g.achievements.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <span className="min-w-0">
                  {a.title}
                  <span className="text-muted block text-xs">
                    {a.kind} · до {a.maxPoints} баллов
                  </span>
                </span>
                {a.status === "approved" ? (
                  <Stamp>+{a.points}</Stamp>
                ) : a.status === "pending" ? (
                  <StatusBadge tone="wait">на проверке</StatusBadge>
                ) : (
                  <StatusBadge tone="danger">отклонено</StatusBadge>
                )}
              </li>
            ))}
          </ul>
        )}
        {approved.length > 0 && (
          <p className="text-muted mt-3 text-xs">
            Засчитано {g.activityPoints} баллов — это +{one.format(r?.bonus ?? 0)} к рейтингу.
          </p>
        )}
      </section>
    </>
  );
}
