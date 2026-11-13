import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Paperclip } from "lucide-react";
import { AchievementStatusBadge } from "@/components/achievement-status";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getAchievementForDean } from "@/lib/data/staff/dean-achievements";
import { decideAchievementAction } from "../actions";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Достижение" };

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});
const one = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const plain = (v: React.ReactNode) => <span className="font-sans text-sm font-normal">{v}</span>;
const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : `${one.format(bytes / 1024 / 1024)} МБ`);

const DONE_TEXT: Record<string, string> = {
  approved: "Достижение засчитано.",
  rejected: "Достижение отклонено.",
};

export default async function DeanAchievementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const a = await getAchievementForDean(id);
  if (!a) notFound();
  const doneText = done && done === a.status ? DONE_TEXT[done] : undefined;
  const room = Math.max(0, a.pointsLimit - a.approvedPoints);

  return (
    <>
      <Link href="/staff" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Все заявки
      </Link>
      <PageTitle eyebrow={`достижение · подано ${when.format(a.createdAt)}`}>{a.title}</PageTitle>

      {doneText && (
        <div className="mb-6">
          <Callout tone="info" lead={doneText}>
            Студент получил уведомление{a.status === "approved" ? ", рейтинг пересчитан." : "."}
          </Callout>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section aria-labelledby="proof-title">
            <SectionTitle>
              <span id="proof-title">Подтверждение</span>
            </SectionTitle>
            <ul className="space-y-2.5 text-sm">
              {a.fileName && (
                <li>
                  <a
                    href={`/staff/achievements/${a.id}/file`}
                    target="_blank"
                    rel="noopener"
                    className="text-brand inline-flex max-w-full items-center gap-1.5 font-semibold hover:underline"
                  >
                    <Paperclip className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{a.fileName}</span>
                    {a.fileSize !== null && <span className="text-muted shrink-0 font-normal">{size(a.fileSize)}</span>}
                  </a>
                </li>
              )}
              {a.proofUrl && (
                <li>
                  {/* Адрес показан целиком: видно, куда ведёт ссылка студента, до перехода. */}
                  <a
                    href={a.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand inline-flex max-w-full items-start gap-1.5 font-semibold hover:underline"
                  >
                    <ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span className="break-all">{a.proofUrl}</span>
                  </a>
                  <p className="text-muted mt-0.5 text-xs">Ссылка от студента, откроется в новой вкладке.</p>
                </li>
              )}
              {!a.fileName && !a.proofUrl && <li className="text-muted">Подтверждение не приложено.</li>}
            </ul>
          </section>

          <Card aria-label="Решение по достижению">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-muted text-sm">Сейчас</p>
              <AchievementStatusBadge status={a.status} points={a.points} />
            </div>
            {a.status === "pending" ? (
              <DecisionForm
                action={decideAchievementAction.bind(null, a.id)}
                maxPoints={a.maxPoints}
                bonusPerPoint={a.coefficient}
                room={room}
              />
            ) : (
              <div className="space-y-1 text-sm">
                <p>
                  {a.status === "approved" ? `Засчитано ${a.points} из ${a.maxPoints} баллов` : "Отклонено"}
                  {a.decidedAt && <span className="text-muted"> · {when.format(a.decidedAt)}</span>}
                </p>
                {a.note && <p>{a.status === "rejected" ? `Причина: ${a.note}` : a.note}</p>}
                <p className="text-muted">Решение принято и больше не меняется.</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="student-title">
            <SectionTitle>
              <span id="student-title">Студент</span>
            </SectionTitle>
            <Ledger>
              <LedgerRow label="ФИО" value={plain(a.student)} />
              <LedgerRow label="Группа" value={plain(`${a.group}, ${a.course} курс`)} />
              <LedgerRow label="Зачётная книжка" value={plain(a.recordBook)} />
              <LedgerRow label="Уже засчитано" value={plain(`${a.approvedPoints} из ${a.pointsLimit}`)} note="за триместр" />
            </Ledger>
          </section>
          <section aria-labelledby="kind-title">
            <SectionTitle>
              <span id="kind-title">Вид достижения</span>
            </SectionTitle>
            <Ledger>
              <LedgerRow label="Направление" value={plain(a.direction)} />
              <LedgerRow label="Вид" value={plain(a.kind)} />
              <LedgerRow label="Максимум" value={plain(`${a.maxPoints} баллов`)} />
            </Ledger>
          </section>
        </div>
      </div>
    </>
  );
}
