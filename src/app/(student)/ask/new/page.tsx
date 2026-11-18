import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/typography";
import { isQuestionTopic, TEXT_MAX } from "@/lib/questions";
import { QuestionForm } from "./question-form";

export const metadata: Metadata = { title: "Написать в деканат" };

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; topic?: string }> }) {
  const { q, topic } = await searchParams;
  // Из «Спроси деканат» приходит вопрос, который кабинет не понял: не заставляем набирать его заново.
  const text = (typeof q === "string" ? q : "").slice(0, TEXT_MAX).trim();

  return (
    <>
      <Link href="/ask" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Спроси деканат
      </Link>
      <PageTitle hint="Вопрос прочитает сотрудник деканата. Ответ придёт уведомлением, обычно в течение рабочего дня.">
        Написать в деканат
      </PageTitle>
      <div className="max-w-xl">
        <QuestionForm initialText={text} initialTopic={isQuestionTopic(topic) ? topic : undefined} />
      </div>
    </>
  );
}
