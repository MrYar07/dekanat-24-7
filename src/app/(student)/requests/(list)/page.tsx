import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, Zap } from "lucide-react";
import { RequestStatusBadge } from "@/components/request-status";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getDocumentCatalog, getMyRequests } from "@/lib/data/requests";
import { documentNumber } from "@/lib/documents/pdf";
import { formatShortDay, mskNow } from "@/lib/time";

export const metadata: Metadata = { title: "Справки" };

export default async function RequestsPage() {
  const [catalog, mine] = await Promise.all([getDocumentCatalog(), getMyRequests()]);

  return (
    <>
      <PageTitle hint="Типовые справки готовы сразу, в PDF с QR-кодом. Остальное деканат делает в срок и пишет в уведомления.">
        Справки
      </PageTitle>

      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-2">
        <section aria-labelledby="catalog-title">
          <SectionTitle>
            <span id="catalog-title">Заказать</span>
          </SectionTitle>
          <ul className="divide-border border-border bg-surface divide-y rounded-xl border">
            {catalog.map((d) => (
              <li key={d.code}>
                <Link
                  href={`/requests/new/${d.code}`}
                  className="hover:bg-surface-2 flex items-center gap-3 px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold">{d.name}</span>
                      {d.instant ? (
                        <span className="text-stamp inline-flex items-center gap-0.5 text-xs font-semibold">
                          <Zap className="size-3.5" aria-hidden="true" />
                          сразу
                        </span>
                      ) : (
                        <span className="text-muted text-xs">до {d.days} раб. дн.</span>
                      )}
                    </span>
                    <span className="text-muted mt-0.5 block text-sm leading-snug">{d.description}</span>
                  </span>
                  <ChevronRight className="text-muted size-5 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="mine-title">
          <SectionTitle>
            <span id="mine-title">Мои заявки</span>
          </SectionTitle>
          {mine.length === 0 ? (
            <EmptyState icon={FileText} title="Заявок пока нет">
              Выбери документ в списке — справка об обучении будет готова через минуту.
            </EmptyState>
          ) : (
            <ul className="divide-border divide-y">
              {mine.map((r) => (
                <li key={r.id}>
                  <Link href={`/requests/${r.id}`} className="group flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="group-hover:text-brand block leading-snug font-semibold">{r.type}</span>
                      <span className="text-muted block text-xs">
                        {r.number !== null &&
                          `№ ${documentNumber(r.code === "rating" ? "rating" : "study", r.number)} · `}
                        подана {formatShortDay(mskNow(r.createdAt).date)}
                      </span>
                    </span>
                    <RequestStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
