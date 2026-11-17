import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RankBars } from "@/components/charts/rank-bars";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getDeanStats, VISITS_SAVED_INSTANT, VISITS_SAVED_REQUEST } from "@/lib/data/staff/dean-stats";
import { MIN_RESPONSES } from "@/lib/feedback";

export const metadata: Metadata = { title: "Сводка" };

const whole = new Intl.NumberFormat("ru-RU");
const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function duration(hours: number) {
  if (hours < 1) return "меньше часа";
  if (hours < 48) return `${Math.round(hours)} ч`;
  return `${Math.round(hours / 24)} дн.`;
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-4!">
      <p className="text-muted text-sm leading-snug">{label}</p>
      <p className="mt-1 font-serif text-[2rem] leading-none font-bold tabular-nums">{value}</p>
      <p className="text-muted mt-2 text-xs leading-snug">{note}</p>
    </Card>
  );
}

export default async function DeanStatsPage() {
  const s = await getDeanStats();
  const total = s.byType.reduce((n, t) => n + t.count, 0);

  return (
    <>
      <Link href="/staff" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Все заявки
      </Link>
      <PageTitle hint="Что кабинет изменил по сравнению с бумажным порядком. Считается по данным кабинета на эту минуту.">
        Сводка
      </PageTitle>

      <section aria-label="Главные числа" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Походов в деканат не понадобилось"
          value={whole.format(s.visitsSaved)}
          note={`По ${VISITS_SAVED_INSTANT} за справку, выданную сразу, и по ${VISITS_SAVED_REQUEST} за заявку с печатью.`}
        />
        <Tile label="Справок выдано сразу" value={whole.format(s.instant)} note="PDF с QR-кодом. Сотрудник в выдаче не участвует." />
        <Tile
          label="Заявок с печатью готово"
          value={whole.format(s.closed)}
          note={s.hoursToReady === null ? "Готовых заявок пока нет." : `От подачи до «готово» в среднем ${duration(s.hoursToReady)}.`}
        />
        <Tile
          label="Баллов за срезы за неделю"
          value={whole.format(s.scoresThisWeek)}
          note="Студент видит балл и новый рейтинг сразу, без ведомости."
        />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="types-title">
          <SectionTitle>
            <span id="types-title">Что заказывают</span>
          </SectionTitle>
          {total === 0 ? (
            <p className="text-muted text-sm">Заявок пока нет.</p>
          ) : (
            <RankBars
              title="Заявки по видам документов"
              unit={["заявка", "заявки", "заявок"]}
              items={s.byType.map((t) => ({ label: t.name, value: t.count, note: t.instant ? "выдаётся сразу" : undefined }))}
            />
          )}

          <section aria-labelledby="feedback-title" className="mt-8">
            <SectionTitle>
              <span id="feedback-title">Оценка преподавания</span>
            </SectionTitle>
            {s.feedback.responses === 0 ? (
              <p className="text-muted text-sm">Студенты ещё не оценивали курсы этого триместра.</p>
            ) : (
              <>
                {s.feedback.courses.length > 0 && (
                  <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
                    {s.feedback.courses.map((c) => (
                      <li key={`${c.discipline}-${c.group}`} className="flex items-center gap-3 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{c.discipline}</span>
                          <span className="text-muted block text-sm">
                            {c.group} · {c.teacher} · {whole.format(c.responses)} отв.
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xl font-bold tabular-nums">{one.format(c.average)}</span>
                          <span className="text-muted block text-xs">из 5</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-muted mt-2 text-sm">
                  Среднее трёх вопросов: понятно ли объясняет, полезны ли занятия, справедливо ли оценивает. Комментарии видит только
                  преподаватель.
                  {s.feedback.hidden > 0 &&
                    ` Ещё курсов с ответами: ${s.feedback.hidden} — у них меньше ${MIN_RESPONSES} ответов, и сводка скрыта.`}
                </p>
              </>
            )}
          </section>
        </section>

        <div className="space-y-8">
          <section aria-labelledby="achievements-title">
            <SectionTitle>
              <span id="achievements-title">Достижения</span>
            </SectionTitle>
            <Ledger>
              <LedgerRow label="На проверке" value={whole.format(s.achievements.pending)} />
              <LedgerRow label="Засчитано" value={whole.format(s.achievements.approved)} />
              <LedgerRow label="Отклонено" value={whole.format(s.achievements.rejected)} />
              <LedgerRow label="Начислено баллов" value={whole.format(s.achievements.points)} />
            </Ledger>
          </section>

          <section aria-labelledby="how-title">
            <SectionTitle>
              <span id="how-title">Как считается</span>
            </SectionTitle>
            <ul className="text-muted space-y-2 text-sm leading-snug">
              <li>
                Бумажная справка — это {VISITS_SAVED_INSTANT} похода: попросить, забрать, поставить печать. Справка из кабинета не требует ни
                одного.
              </li>
              <li>Заявка с печатью оставляет один поход — забрать готовый документ. Экономия — {VISITS_SAVED_REQUEST}.</li>
              <li>Данные вымышленные и пересоздаются каждую ночь, поэтому числа небольшие.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
