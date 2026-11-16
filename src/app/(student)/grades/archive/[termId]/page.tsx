import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { StatusBadge } from "@/components/ui/status";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getMyArchivedTerm } from "@/lib/data/learning";
import { MARK_LABEL, explainDiscipline, markFor, type GradingSettings } from "@/lib/grading";

export const metadata: Metadata = { title: "Триместр в архиве" };

const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

type Term = Extract<NonNullable<Awaited<ReturnType<typeof getMyArchivedTerm>>>, { current: false }>;

/** Сессия словами: автомат, экзамен, зачёт с потолком или пересдача со штрафом. */
function sessionText(c: Term["courses"][number], s: GradingSettings) {
  const b = explainDiscipline(c.input, s);
  if (!b) return null;
  const x = b.session;
  if (x.mode === "auto") return { value: one.format(x.value), note: "автомат" };
  const what = x.kind === "exam" ? "экзамен" : "зачёт";
  if (x.retakes > 0) return { value: one.format(x.value), note: `${what}: ${x.raw} − ${x.penalty} за пересдачу` };
  if (x.capped) return { value: one.format(x.value), note: `${what}: ${x.raw}, без автомата — не выше ${s.creditCapWithoutAuto}` };
  return { value: one.format(x.value), note: what };
}

export default async function ArchivedTermPage({ params }: { params: Promise<{ termId: string }> }) {
  const { termId } = await params;
  const t = await getMyArchivedTerm(termId);
  if (!t) notFound();
  if (t.current) redirect("/grades");
  const s = t.settings;
  const r = t.rating;

  return (
    <>
      <Link href="/grades/archive" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Архив
      </Link>
      <PageTitle eyebrow={`${t.term.academicYear} учебный год · триместр закрыт`}>{t.term.name}</PageTitle>

      {r && (
        <Card aria-label="Итог триместра" className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-muted font-serif text-sm italic">Рейтинг триместра</p>
              <p className="mt-1 font-serif text-[44px] leading-none font-bold tabular-nums">{one.format(r.rating)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.retakes > 0 && <StatusBadge tone="warn">{t.retakes === 1 ? "была пересдача" : `пересдач: ${t.retakes}`}</StatusBadge>}
              {t.retakes === 0 && r.rating >= s.privileges.scholarshipFrom && (
                <StatusBadge tone="ok">повышенная стипендия на следующий триместр</StatusBadge>
              )}
            </div>
          </div>
          <Ledger className="mt-4">
            <LedgerRow label="Средний балл — идёт в годовой" value={one.format(r.base)} />
            <LedgerRow label="Бонус активности" value={`+${one.format(r.bonus)}`} note={`${t.activityPoints} из ${s.activityPointsMax}`} />
          </Ledger>
        </Card>
      )}

      <section aria-labelledby="archived-courses" className="mb-8">
        <SectionTitle>
          <span id="archived-courses">Дисциплины</span>
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {t.courses.map((c) => {
            const session = sessionText(c, s);
            const retake = c.retakes > 0;
            return (
              <Card key={c.id} aria-labelledby={`ac-${c.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 id={`ac-${c.id}`} className="font-serif text-lg leading-snug font-bold break-words hyphens-auto">
                      {c.discipline}
                    </h3>
                    <p className="text-muted text-sm">
                      {c.teacher} · {c.assessment === "exam" ? "экзамен" : "зачёт"}
                    </p>
                    {retake && (
                      <p className="mt-1.5">
                        <StatusBadge tone="warn">пересдача</StatusBadge>
                      </p>
                    )}
                  </div>
                  {c.result && (
                    <div className="shrink-0 text-right">
                      <p className="font-serif text-2xl leading-none font-bold tabular-nums">{one.format(c.result.score)}</p>
                      <p className="text-muted mt-1 text-xs">{MARK_LABEL[markFor(c.result.score, s)]}</p>
                    </div>
                  )}
                </div>
                <p className="text-muted mt-3 text-sm tabular-nums">
                  Срезы: {c.checkpoints.map((cp) => cp.score ?? "—").join(" · ")}
                </p>
                {c.result && (
                  <Ledger className="mt-3">
                    <LedgerRow label="Работа в триместре · 40%" value={one.format(c.result.work)} note={c.bonus > 0 ? `бонус +${c.bonus}` : undefined} />
                    {session && <LedgerRow label="Сессия · 45%" value={session.value} note={session.note} />}
                    <LedgerRow
                      label="Вовлечённость · 15%"
                      value={one.format(c.result.engagement)}
                      note={c.attendance.pct === null ? undefined : `посещаемость ${whole.format(c.attendance.pct)}%`}
                    />
                  </Ledger>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="archived-achievements">
        <SectionTitle>
          <span id="archived-achievements">Засчитанные достижения</span>
        </SectionTitle>
        {t.achievements.length === 0 ? (
          <p className="text-muted text-sm">В этом триместре достижений не было.</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {t.achievements.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                <span className="min-w-0">
                  {a.title}
                  <span className="text-muted block text-xs">{a.kind}</span>
                </span>
                <span className="font-semibold tabular-nums">+{a.points}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
