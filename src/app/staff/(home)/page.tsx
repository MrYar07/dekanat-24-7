import type { Metadata } from "next";
import Link from "next/link";
import { Award, ChevronRight, Inbox, NotebookPen, Zap } from "lucide-react";
import { AchievementStatusBadge } from "@/components/achievement-status";
import { RequestStatusBadge } from "@/components/request-status";
import { FilterChip, FilterChips } from "@/components/ui/filter-chips";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { requireRole } from "@/lib/auth/dal";
import { getRequestQueue, isQueueFilter, QUEUE_FILTERS, type QueueFilter } from "@/lib/data/staff/dean";
import { getAchievementQueue } from "@/lib/data/staff/dean-achievements";
import { getMyCourses } from "@/lib/data/staff/teacher";

export const metadata: Metadata = { title: "Кабинет сотрудника" };

const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });

const EMPTY: Record<QueueFilter, string> = {
  active: "Новых заявок нет. Когда студент подаст заявку, она появится здесь.",
  ready: "Нет документов, которые ждут студента.",
  done: "Закрытых заявок пока нет.",
  all: "Заявок пока нет.",
};

async function DeanQueue({ filter }: { filter: QueueFilter }) {
  // Одна очередь на всё, что ждёт решения деканата: заявки на документы и достижения для рейтинга.
  const [requests, achievements] = await Promise.all([getRequestQueue(filter), getAchievementQueue(filter)]);
  const waiting = requests.counts.active + achievements.counts.active;
  const items = [
    ...requests.items.map((r) => ({ ...r, source: "request" as const })),
    ...achievements.items.map((a) => ({ ...a, source: "achievement" as const })),
  ].sort((a, b) =>
    filter === "active" ? a.createdAt.getTime() - b.createdAt.getTime() : b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  return (
    <>
      <PageTitle
        eyebrow="деканат"
        hint={waiting > 0 ? `Ждут решения: ${waiting}. Сверху те, кто подал раньше.` : "Все заявки разобраны."}
      >
        Заявки студентов
      </PageTitle>

      <div className="mb-5">
        <FilterChips label="Статус заявок">
          {(Object.keys(QUEUE_FILTERS) as QueueFilter[]).map((f) => (
            <FilterChip
              key={f}
              href={f === "active" ? "/staff" : `/staff?filter=${f}`}
              active={filter === f}
              label={QUEUE_FILTERS[f].label}
              count={f === "active" ? waiting : undefined}
              countLabel="ждут"
            />
          ))}
        </FilterChips>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="Пусто">
          {EMPTY[filter]}
        </EmptyState>
      ) : (
        <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
          {items.map((r) =>
            r.source === "achievement" ? (
              <li key={r.id}>
                <Link href={`/staff/achievements/${r.id}`} className="hover:bg-surface-2 flex items-center gap-3 px-4 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{r.title}</span>
                    <span className="text-muted mt-0.5 block text-sm">
                      {r.student} · {r.group}
                    </span>
                    <span className="text-muted mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <AchievementStatusBadge status={r.status} points={r.points} />
                      <span className="inline-flex items-center gap-0.5">
                        <Award className="size-3.5" aria-hidden="true" />
                        достижение
                      </span>
                      <span>
                        подано {day.format(r.createdAt)} · до {r.maxPoints} баллов
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="text-muted size-5 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ) : (
            <li key={r.id}>
              <Link href={`/staff/requests/${r.id}`} className="hover:bg-surface-2 flex items-center gap-3 px-4 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.type}</span>
                  <span className="text-muted mt-0.5 block text-sm">
                    {r.student} · {r.group}
                  </span>
                  <span className="text-muted mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <RequestStatusBadge status={r.status} />
                    <span>
                      подана {day.format(r.createdAt)}
                      {!r.instant && r.days ? ` · срок до ${r.days} раб. дн.` : ""}
                    </span>
                    {r.instant && (
                      <span className="inline-flex items-center gap-0.5">
                        <Zap className="size-3.5" aria-hidden="true" />
                        автоматически
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="text-muted size-5 shrink-0" aria-hidden="true" />
              </Link>
            </li>
            ),
          )}
        </ul>
      )}
    </>
  );
}

async function TeacherCourses({ name }: { name: string }) {
  const courses = await getMyCourses();
  return (
    <>
      <PageTitle eyebrow="преподаватель" hint="Курсы этого триместра. Балл за срез студент видит сразу и получает уведомление.">
        {name}
      </PageTitle>

      {courses.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Курсов нет">
          В этом триместре курсы не закреплены. Если это ошибка, сообщите в деканат.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/staff/courses/${c.id}`}
                className="border-border bg-surface hover:bg-surface-2 flex h-full items-center gap-3 rounded-xl border p-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg font-bold">{c.discipline}</span>
                  <span className="text-muted block text-sm">
                    {c.group} · студентов: {c.students} · {c.assessment === "exam" ? "экзамен" : "зачёт"}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
                    {c.checkpoints.map((cp) => (
                      <span key={cp.number} className={cp.graded >= c.students ? "text-muted" : "font-semibold"}>
                        срез {cp.number}: {cp.graded} из {c.students}
                      </span>
                    ))}
                  </span>
                </span>
                <ChevronRight className="text-muted size-5 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function StaffHome({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireRole("teacher", "dean_office");
  if (user.role === "teacher") {
    return <TeacherCourses name={`${user.firstName}${user.middleName ? ` ${user.middleName}` : ""}`} />;
  }
  const { filter } = await searchParams;
  return <DeanQueue filter={isQueueFilter(filter) ? filter : "active"} />;
}
