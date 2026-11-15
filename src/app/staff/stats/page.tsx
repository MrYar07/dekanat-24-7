import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RankBars } from "@/components/charts/rank-bars";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getDeanStats, VISITS_SAVED_INSTANT, VISITS_SAVED_REQUEST } from "@/lib/data/staff/dean-stats";

export const metadata: Metadata = { title: "Сводка" };

const whole = new Intl.NumberFormat("ru-RU");

function duration(hours: number) {
  if (hours < 1) return "меньше часа";
  if (hours < 48) return `${Math.round(hours)} ч`;
  return `${Math.round(hours / 24)} дн.`;
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-4!">
      <p className="text-muted text-sm leading-snug">{label}</p>
      <p className="mt-1 font-serif text-[32px] leading-none font-bold tabular-nums">{value}</p>
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
