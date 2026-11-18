import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { getMyFeedbackCourse } from "@/lib/data/feedback";
import { COMMENT_MAX, MIN_RESPONSES, QUESTIONS } from "@/lib/feedback";
import { submitFeedbackAction } from "../actions";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Оценить курс" };

// Без loading.tsx на этом уровне: иначе notFound() для чужого курса отдавал бы 200 вместо 404.
export default async function FeedbackCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getMyFeedbackCourse(id);
  // Курс другой группы и несуществующий выглядят одинаково.
  if (!course) notFound();

  return (
    <>
      <Link href="/grades/feedback" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Все курсы
      </Link>
      <PageTitle eyebrow={course.teacher} hint={`Ответ анонимный. Преподаватель увидит только сводку, когда ответят не меньше ${MIN_RESPONSES} человек.`}>
        {course.discipline}
      </PageTitle>

      <div className="max-w-xl">
        {course.voted ? (
          <EmptyState icon={Check} title="Курс уже оценён">
            Ответ нельзя изменить: он ни с кем не связан, даже с тобой.
          </EmptyState>
        ) : (
          <Card>
            <FeedbackForm action={submitFeedbackAction.bind(null, course.id)} questions={QUESTIONS} commentMax={COMMENT_MAX} />
          </Card>
        )}
      </div>
    </>
  );
}
