import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, ChevronLeft, UsersRound } from "lucide-react";
import { FilterChip, FilterChips } from "@/components/ui/filter-chips";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { getMyCourseAttendance } from "@/lib/data/staff/teacher";
import { formatShortDay } from "@/lib/time";
import { saveAttendanceAction } from "../../../actions";
import { CourseTabs } from "../tabs";
import { AttendanceForm } from "./attendance-form";

export const metadata: Metadata = { title: "Посещаемость" };

const KIND = { lecture: "лекция", seminar: "семинар" } as const;

export default async function CourseAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const [{ id }, { lesson }] = await Promise.all([params, searchParams]);
  const data = await getMyCourseAttendance(id, lesson);
  // Чужой курс и несуществующий выглядят одинаково.
  if (!data) notFound();
  const { course, lessons, selected, students } = data;

  return (
    <>
      <Link href="/staff" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Мои курсы
      </Link>
      <PageTitle
        eyebrow={`${course.group} · ${course.assessment === "exam" ? "экзамен" : "зачёт"}`}
        hint="Отметка видна студенту сразу: в расписании и в балле дисциплины. О пропуске он получает уведомление."
      >
        {course.discipline}
      </PageTitle>
      <CourseTabs courseId={course.id} active="attendance" />

      {students.length === 0 ? (
        <EmptyState icon={UsersRound} title="Отмечать некого">
          В группе нет студентов.
        </EmptyState>
      ) : !selected ? (
        <EmptyState icon={CalendarCheck} title="Пар ещё не было">
          Отметить посещаемость можно, как только начнётся первая пара курса.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5">
            <FilterChips label="Пара" long>
              {lessons.map((l, i) => (
                <FilterChip
                  key={l.key}
                  href={`/staff/courses/${course.id}/attendance?lesson=${l.key}`}
                  active={l.key === selected.key}
                  label={`${i === 0 ? "Последняя · " : ""}${formatShortDay(l.date)}, ${l.startsAt}`}
                  count={students.length - l.marked || undefined}
                  countLabel="без отметки"
                />
              ))}
            </FilterChips>
          </div>
          <p className="text-muted mb-3 text-sm">
            {KIND[selected.kind]} · {selected.startsAt}–{selected.endsAt} · {selected.room}
          </p>
          {/* key: при переходе на другую пару переключатели создаются заново с её отметками. */}
          <AttendanceForm
            key={selected.key}
            action={saveAttendanceAction.bind(null, course.id, selected.key)}
            students={students}
          />
        </>
      )}
    </>
  );
}
