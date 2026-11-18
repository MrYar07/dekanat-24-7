import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PenLine } from "lucide-react";
import { QuestionStatusBadge } from "@/components/question-status";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getMyQuestion } from "@/lib/data/questions";

export const metadata: Metadata = { title: "Вопрос в деканат" };

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

export default async function QuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, { new: justCreated }] = await Promise.all([params, searchParams]);
  const q = await getMyQuestion(id);
  // Чужой и несуществующий вопрос выглядят одинаково.
  if (!q) notFound();

  return (
    <>
      <Link href="/ask" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Спроси деканат
      </Link>
      <PageTitle eyebrow={`отправлен ${when.format(q.createdAt)}`}>{q.topic}</PageTitle>

      {justCreated && q.status === "open" && (
        <div className="mb-6">
          <Callout tone="info" lead="Вопрос отправлен.">
            Когда деканат ответит, придёт уведомление. Эта страница обновится сама.
          </Callout>
        </div>
      )}

      <div className="max-w-xl space-y-6">
        <section aria-labelledby="question-title">
          <SectionTitle action={<QuestionStatusBadge status={q.status} />}>
            <span id="question-title">Твой вопрос</span>
          </SectionTitle>
          <p className="text-base whitespace-pre-line">{q.text}</p>
        </section>

        <section aria-labelledby="answer-title">
          <SectionTitle>
            <span id="answer-title">Ответ деканата</span>
          </SectionTitle>
          {q.status === "answered" && q.answer ? (
            <Card>
              <p className="text-base whitespace-pre-line">{q.answer}</p>
              {q.answeredAt && <p className="text-muted mt-3 text-sm">Деканат, {when.format(q.answeredAt)}</p>}
            </Card>
          ) : (
            <p className="text-muted text-sm">
              Пока нет. Деканат отвечает в будни с 10:00 до 17:00, обычно в течение рабочего дня. Ответ придёт уведомлением.
            </p>
          )}
        </section>

        {q.status === "answered" && (
          <Link href="/ask/new" className={buttonClass("secondary")}>
            <PenLine className="size-4" aria-hidden="true" />
            Задать ещё вопрос
          </Link>
        )}
      </div>
    </>
  );
}
