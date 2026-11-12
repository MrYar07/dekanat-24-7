import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RequestStatusBadge, STATUS_LABEL, type RequestStatus } from "@/components/request-status";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getRequestForDean } from "@/lib/data/staff/dean";
import { PAYLOAD_LABELS } from "@/lib/documents/forms";
import { changeStatusAction } from "../../actions";
import { StatusForm } from "./status-form";

export const metadata: Metadata = { title: "Заявка" };

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});
const ORDER = Object.keys(PAYLOAD_LABELS);
const plain = (v: React.ReactNode) => <span className="font-sans text-sm font-normal">{v}</span>;

const DONE_TEXT: Partial<Record<RequestStatus, string>> = {
  in_review: "Заявка взята в работу.",
  ready: "Заявка отмечена готовой.",
  issued: "Документ отмечен выданным.",
  rejected: "Заявка отклонена.",
};

export default async function DeanRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const r = await getRequestForDean(id);
  if (!r) notFound();
  const doneText = done ? DONE_TEXT[done as RequestStatus] : undefined;

  return (
    <>
      <Link href="/staff" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Все заявки
      </Link>
      <PageTitle eyebrow={`подана ${when.format(r.createdAt)}`}>{r.type}</PageTitle>

      {doneText && (
        <div className="mb-6">
          <Callout tone="info" lead={doneText}>
            Студент получил уведомление.
          </Callout>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card aria-label="Решение по заявке">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-muted text-sm">Сейчас</p>
              <RequestStatusBadge status={r.status} />
            </div>
            {r.instant ? (
              <p className="text-muted text-sm">
                Эта справка формируется автоматически: студент скачивает PDF с QR-кодом сам. Действий деканата не
                требуется.
              </p>
            ) : r.next.length === 0 ? (
              <p className="text-muted text-sm">Заявка закрыта, статус больше не меняется.</p>
            ) : (
              // key: после смены статуса форма начинается заново, с новым набором действий.
              <StatusForm key={r.status} action={changeStatusAction.bind(null, r.id)} next={r.next} />
            )}
          </Card>

          <section aria-labelledby="history-title">
            <SectionTitle>
              <span id="history-title">История</span>
            </SectionTitle>
            <ol className="space-y-3">
              {r.events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${e.status === "rejected" ? "bg-danger" : "bg-brand"}`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {STATUS_LABEL[e.status][0].toUpperCase() + STATUS_LABEL[e.status].slice(1)}
                      <span className="text-muted ml-2 text-xs font-normal">{when.format(e.createdAt)}</span>
                    </p>
                    {e.note && <p className="mt-0.5 text-sm">{e.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="student-title">
            <SectionTitle>
              <span id="student-title">Студент</span>
            </SectionTitle>
            <Ledger>
              <LedgerRow label="ФИО" value={plain(r.student)} />
              <LedgerRow label="Группа" value={plain(`${r.group}, ${r.course} курс`)} />
              <LedgerRow label="Зачётная книжка" value={plain(r.recordBook)} />
            </Ledger>
          </section>
          <section aria-labelledby="details-title">
            <SectionTitle>
              <span id="details-title">Данные заявки</span>
            </SectionTitle>
            <Ledger>
              {Object.entries(r.payload)
                .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
                .map(([k, v]) => (
                  <LedgerRow
                    key={k}
                    label={PAYLOAD_LABELS[k] ?? k}
                    value={<span className="font-sans text-sm font-normal break-all">{String(v)}</span>}
                  />
                ))}
              {!r.instant && r.days && <LedgerRow label="Срок" value={plain(`до ${r.days} раб. дней`)} />}
            </Ledger>
          </section>
        </div>
      </div>
    </>
  );
}
