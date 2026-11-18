import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, MessageSquareHeart } from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { getMyFeedbackCourses } from "@/lib/data/feedback";
import { MIN_RESPONSES } from "@/lib/feedback";

export const metadata: Metadata = { title: "Оценка преподавания" };

export default async function FeedbackListPage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const [list, { thanks }] = await Promise.all([getMyFeedbackCourses(), searchParams]);
  const left = list.filter((c) => !c.voted).length;

  return (
    <>
      <Link href="/grades" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Успеваемость
      </Link>
      <PageTitle
        hint={`Три вопроса о каждом курсе триместра. Ответ анонимный: преподаватель видит только средние оценки и комментарии, и только когда ответят хотя бы ${MIN_RESPONSES} человек из группы.`}
      >
        Оценка преподавания
      </PageTitle>

      {thanks && (
        <div className="mb-5">
          <Callout tone="info" lead="Спасибо, ответ сохранён.">
            {left > 0 ? `Осталось оценить: ${left}.` : "Все курсы триместра оценены."}
          </Callout>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon={MessageSquareHeart} title="Оценивать пока нечего">
          Курсы текущего триместра появятся здесь, когда начнётся триместр.
        </EmptyState>
      ) : (
        <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
          {list.map((c) => (
            <li key={c.id}>
              {c.voted ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.discipline}</span>
                    <span className="text-muted block text-sm">{c.teacher}</span>
                  </span>
                  <span className="text-ok inline-flex shrink-0 items-center gap-1 text-sm">
                    <Check className="size-4" aria-hidden="true" />
                    оценено
                  </span>
                </div>
              ) : (
                <Link href={`/grades/feedback/${c.id}`} className="hover:bg-surface-2 flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.discipline}</span>
                    <span className="text-muted block text-sm">{c.teacher}</span>
                  </span>
                  <span className="text-brand inline-flex shrink-0 items-center gap-1 text-sm font-medium">
                    оценить
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
