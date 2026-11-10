import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { RequestStatusBadge, STATUS_LABEL, type RequestStatus } from "@/components/request-status";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getMyRequest } from "@/lib/data/requests";
import { PAYLOAD_LABELS } from "@/lib/documents/forms";
import { verifyUrl } from "@/lib/site";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Заявка" };

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

const ORDER = Object.keys(PAYLOAD_LABELS);

/** Шаги трекера. У мгновенной справки нет шага «в работе». */
function steps(instant: boolean, status: RequestStatus): RequestStatus[] {
  if (status === "rejected") return ["submitted", "rejected"];
  return instant ? ["submitted", "ready", "issued"] : ["submitted", "in_review", "ready", "issued"];
}

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, { new: justCreated }] = await Promise.all([params, searchParams]);
  const r = await getMyRequest(id);
  // Чужая и несуществующая заявка выглядят одинаково.
  if (!r) notFound();

  const flow = steps(r.instant, r.status);
  const reached = flow.indexOf(r.status);
  const at = (s: RequestStatus) => r.events.find((e) => e.status === s)?.createdAt;
  const doc = r.document && !r.document.revokedAt ? r.document : null;
  const url = doc ? await verifyUrl(doc.code) : null;

  return (
    <>
      <Link href="/requests" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Все справки
      </Link>
      <PageTitle eyebrow={doc ? `№ ${doc.label}` : `подана ${when.format(r.createdAt)}`}>{r.type}</PageTitle>

      {justCreated && doc && (
        <div className="mb-6">
          <Callout tone="info" lead="Готово.">
            Справка сформирована. Скачай PDF или отправь ссылку для проверки тому, кто её просил.
          </Callout>
        </div>
      )}
      {justCreated && !doc && (
        <div className="mb-6">
          <Callout tone="info" lead="Заявка в деканате.">
            Когда статус изменится, придёт уведомление.
          </Callout>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {doc && url && (
            <Card aria-label="Документ">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg font-bold">№ {doc.label}</p>
                  <p className="text-muted text-sm">PDF с QR-кодом проверки подлинности</p>
                </div>
                <RequestStatusBadge status={r.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {/* Обычная ссылка, не <Link>: файл не должен предзагружаться, первое скачивание меняет статус. */}
                <a
                  href={`/requests/${r.id}/document`}
                  className={buttonClass("primary")}
                  target="_blank"
                  rel="noopener"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Скачать PDF
                </a>
                <CopyLink url={url} />
              </div>
            </Card>
          )}

          <section aria-labelledby="track-title">
            <SectionTitle>
              <span id="track-title">Статус</span>
            </SectionTitle>
            <ol className="space-y-0">
              {flow.map((s, i) => {
                const done = i <= reached;
                const time = at(s);
                return (
                  <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < flow.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`absolute top-5 left-[9px] h-[calc(100%-12px)] w-0.5 ${i < reached ? "bg-brand" : "bg-border"}`}
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={`relative mt-0.5 size-5 shrink-0 rounded-full border-2 ${
                        s === "rejected"
                          ? "border-danger bg-danger"
                          : done
                            ? "border-brand bg-brand"
                            : "border-border bg-surface"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className={`font-semibold ${done ? "" : "text-muted"}`}>
                        {STATUS_LABEL[s][0].toUpperCase() + STATUS_LABEL[s].slice(1)}
                        <span className="sr-only">{done ? " — пройдено" : " — ещё впереди"}</span>
                      </p>
                      {time && <p className="text-muted text-xs">{when.format(time)}</p>}
                      {r.events
                        .filter((e) => e.status === s && e.note)
                        .map((e, k) => (
                          <p key={k} className="mt-0.5 text-sm">
                            {e.note}
                          </p>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <section aria-labelledby="details-title">
          <SectionTitle>
            <span id="details-title">Данные заявки</span>
          </SectionTitle>
          <Ledger>
            <LedgerRow
              label="Подана"
              value={<span className="font-sans text-sm font-normal">{when.format(r.createdAt)}</span>}
            />
            {/* jsonb хранит ключи по длине, а не в порядке формы: возвращаем порядок полей. */}
            {Object.entries(r.payload)
              .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
              .map(([k, v]) => (
                <LedgerRow
                  key={k}
                  label={PAYLOAD_LABELS[k] ?? k}
                  value={<span className="font-sans text-sm font-normal break-all">{String(v)}</span>}
                />
              ))}
            {!r.instant && r.days && (
              <LedgerRow
                label="Срок"
                value={<span className="font-sans text-sm font-normal">до {r.days} раб. дней</span>}
              />
            )}
          </Ledger>
        </section>
      </div>
    </>
  );
}
