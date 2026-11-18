import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QuestionStatusBadge } from "@/components/question-status";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getQuestionForDean } from "@/lib/data/staff/dean-questions";
import { answerQuestionAction } from "../actions";
import { AnswerForm } from "./answer-form";

export const metadata: Metadata = { title: "Вопрос студента" };

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});
const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });
const plain = (v: React.ReactNode) => <span className="font-sans text-sm font-normal">{v}</span>;

export default async function DeanQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const q = await getQuestionForDean(id);
  if (!q) notFound();

  return (
    <>
      <Link href="/staff" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Все заявки
      </Link>
      <PageTitle eyebrow={`вопрос · ${when.format(q.createdAt)}`}>{q.topic}</PageTitle>

      {done && q.status === "answered" && (
        <div className="mb-6">
          <Callout tone="info" lead="Ответ отправлен.">
            Студент получил уведомление.
          </Callout>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section aria-labelledby="question-title">
            <SectionTitle action={<QuestionStatusBadge status={q.status} />}>
              <span id="question-title">Вопрос</span>
            </SectionTitle>
            <p className="text-base whitespace-pre-line">{q.text}</p>
          </section>

          <Card aria-label="Ответ на вопрос">
            {q.status === "open" ? (
              <AnswerForm action={answerQuestionAction.bind(null, q.id)} />
            ) : (
              <div className="space-y-2">
                <p className="text-base whitespace-pre-line">{q.answer}</p>
                <p className="text-muted text-sm">
                  {q.answeredBy ? `${q.answeredBy}, ` : ""}
                  {q.answeredAt ? when.format(q.answeredAt) : ""}. Ответ отправлен и больше не меняется.
                </p>
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
              <LedgerRow label="ФИО" value={plain(q.student)} />
              <LedgerRow label="Группа" value={plain(`${q.group}, ${q.course} курс`)} />
              <LedgerRow label="Зачётная книжка" value={plain(q.recordBook)} />
            </Ledger>
          </section>
          {q.earlier.length > 0 && (
            <section aria-labelledby="earlier-title">
              <SectionTitle>
                <span id="earlier-title">Прежние вопросы</span>
              </SectionTitle>
              <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
                {q.earlier.map((e) => (
                  <li key={e.id}>
                    <Link href={`/staff/questions/${e.id}`} className="hover:bg-surface-2 flex items-center gap-3 px-3.5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{e.preview}</span>
                        <span className="text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <QuestionStatusBadge status={e.status} />
                          {day.format(e.createdAt)}
                        </span>
                      </span>
                      <ChevronRight className="text-muted size-4 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
