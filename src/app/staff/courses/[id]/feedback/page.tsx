import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, EyeOff, Quote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getMyCourseFeedback } from "@/lib/data/staff/teacher";
import { MIN_RESPONSES } from "@/lib/feedback";
import { CourseTabs } from "../tabs";

export const metadata: Metadata = { title: "Отзывы студентов" };

const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function answers(n: number) {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? "ответ" : d >= 2 && d <= 4 && (h < 12 || h > 14) ? "ответа" : "ответов";
}

export default async function CourseFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMyCourseFeedback(id);
  // Чужой курс и несуществующий выглядят одинаково.
  if (!data) notFound();
  const { course, students, summary } = data;

  return (
    <>
      <Link href="/staff" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Мои курсы
      </Link>
      <PageTitle
        eyebrow={`${course.group} · ${course.assessment === "exam" ? "экзамен" : "зачёт"}`}
        hint={`Анонимная оценка студентов за текущий триместр. Кто как ответил, не видно никому. Сводка открывается от ${MIN_RESPONSES} ответов.`}
      >
        {course.discipline}
      </PageTitle>
      <CourseTabs courseId={course.id} active="feedback" />

      {!summary.visible ? (
        <EmptyState icon={EyeOff} title={summary.count === 0 ? "Ответов пока нет" : `Пока ${summary.count} ${answers(summary.count)} из ${students}`}>
          Сводка появится, когда ответят ещё {summary.needed} {summary.needed === 1 ? "студент" : "студента"}: при нескольких ответах легко
          догадаться, кто что поставил.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="feedback-scores">
            <SectionTitle>
              <span id="feedback-scores">
                {summary.count} {answers(summary.count)} из {students}
              </span>
            </SectionTitle>
            <div className="a11y-one-col grid gap-4 md:grid-cols-3">
              {summary.questions.map((q) => {
                const max = Math.max(...q.distribution, 1);
                return (
                  <Card key={q.key} aria-label={q.label}>
                    <p className="text-muted text-sm">{q.label}</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums">
                      {one.format(q.average)}
                      <span className="text-muted text-base font-normal"> из 5</span>
                    </p>
                    {/* Распределение: сколько поставили 5, 4, … 1. */}
                    <ul className="mt-3 space-y-1" aria-label="Распределение оценок">
                      {[5, 4, 3, 2, 1].map((n) => {
                        const c = q.distribution[n - 1];
                        return (
                          <li key={n} className="flex items-center gap-2 text-xs tabular-nums">
                            <span className="text-muted w-3">{n}</span>
                            <span className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                              <span className="bg-brand block h-full rounded-full" style={{ width: `${(c / max) * 100}%` }} />
                            </span>
                            <span className="w-4 text-right">{c}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="feedback-comments">
            <SectionTitle>
              <span id="feedback-comments">Комментарии</span>
            </SectionTitle>
            {summary.comments.length === 0 ? (
              <p className="text-muted text-sm">Комментариев нет: оставлять их необязательно.</p>
            ) : (
              <ul className="space-y-3">
                {summary.comments.map((c, i) => (
                  <li key={i} className="border-border bg-surface flex gap-3 rounded-xl border px-4 py-3 text-sm">
                    <Quote className="text-muted mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 whitespace-pre-line">{c}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted mt-3 text-xs">Порядок комментариев — по алфавиту, а не по времени: так нельзя связать их с теми, кто отвечал.</p>
          </section>
        </div>
      )}
    </>
  );
}
