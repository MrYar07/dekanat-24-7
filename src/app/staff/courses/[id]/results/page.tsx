import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { getMyCourseResults } from "@/lib/data/staff/teacher";
import { saveResultsAction } from "../../../actions";
import { CourseTabs } from "../tabs";
import { ResultsForm } from "./results-form";

export const metadata: Metadata = { title: "Активность и бонус" };

export default async function CourseResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMyCourseResults(id);
  // Чужой курс и несуществующий выглядят одинаково.
  if (!data) notFound();
  const { course, students, bonusMax } = data;

  return (
    <>
      <Link href="/staff" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Мои курсы
      </Link>
      <PageTitle
        eyebrow={`${course.group} · ${course.assessment === "exam" ? "экзамен" : "зачёт"}`}
        hint={`Активность на занятиях — половина вовлечённости (15% балла дисциплины). Бонус до +${bonusMax} добавляется к работе в триместре за особые успехи. Студент видит изменения сразу.`}
      >
        {course.discipline}
      </PageTitle>
      <CourseTabs courseId={course.id} active="results" />

      {students.length === 0 ? (
        <EmptyState icon={UsersRound} title="В группе нет студентов">
          Оценивать некого.
        </EmptyState>
      ) : (
        <ResultsForm action={saveResultsAction.bind(null, course.id)} students={students} bonusMax={bonusMax} />
      )}
    </>
  );
}
