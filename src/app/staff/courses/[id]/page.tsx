import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, NotebookPen } from "lucide-react";
import { FilterChip, FilterChips } from "@/components/ui/filter-chips";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { getMyCourseJournal } from "@/lib/data/staff/teacher";
import { saveScoresAction } from "../../actions";
import { JournalForm } from "./journal-form";

export const metadata: Metadata = { title: "Журнал курса" };

export default async function CourseJournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cp?: string }>;
}) {
  const [{ id }, { cp }] = await Promise.all([params, searchParams]);
  const journal = await getMyCourseJournal(id, cp ? Number(cp) : undefined);
  // Чужой курс и несуществующий выглядят одинаково.
  if (!journal) notFound();
  const { course, checkpoints, selected, students } = journal;

  return (
    <>
      <Link href="/staff" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Мои курсы
      </Link>
      <PageTitle
        eyebrow={`${course.group} · ${course.assessment === "exam" ? "экзамен" : "зачёт"}`}
        hint="Баллы за срез: от 0 до 100. Enter переводит к следующему студенту."
      >
        {course.discipline}
      </PageTitle>

      {!selected || students.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Ставить пока нечего">
          {students.length === 0 ? "В группе нет студентов." : "Для курса не запланированы срезы."}
        </EmptyState>
      ) : (
        <>
          <div className="mb-5">
            <FilterChips label="Срез">
              {checkpoints.map((c) => (
                <FilterChip
                  key={c.number}
                  href={`/staff/courses/${course.id}?cp=${c.number}`}
                  active={c.number === selected.number}
                  label={`Срез ${c.number} · ${c.week}-я нед.`}
                  count={students.length - c.graded || undefined}
                  countLabel="без балла"
                />
              ))}
            </FilterChips>
          </div>
          {/* key: при переходе на другой срез поля ввода создаются заново с его баллами. */}
          <JournalForm
            key={selected.number}
            action={saveScoresAction.bind(null, course.id, selected.number)}
            cpNumber={selected.number}
            students={students}
          />
        </>
      )}
    </>
  );
}
