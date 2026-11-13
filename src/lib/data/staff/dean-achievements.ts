import "server-only";
import { and, asc, count, desc, eq, inArray, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  achievementFiles,
  achievementKinds,
  achievements,
  gradingSettings,
  groups,
  notifications,
  studentProfiles,
  users,
} from "@/db/schema";
import { checkDecision, type DecisionInput } from "@/lib/achievements";
import { requireRole } from "@/lib/auth/dal";
import { DEFAULT_SETTINGS } from "@/lib/grading";
import type { QueueFilter } from "./dean";

// Деканат: достижения студентов для бонуса активности. Проверить подтверждение, засчитать баллы
// (не больше максимума за вид) или отклонить с причиной. Роль проверяет каждая функция.

type Status = (typeof achievements.$inferSelect)["status"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Какие статусы достижений попадают под фильтры общей очереди заявок. «Готовы» — только про документы. */
const STATUSES: Record<QueueFilter, readonly Status[] | null> = {
  active: ["pending"],
  ready: [],
  done: ["approved", "rejected"],
  all: null,
};

const studentName = (u: { lastName: string; firstName: string; middleName: string | null }) =>
  `${u.lastName} ${u.firstName}${u.middleName ? ` ${u.middleName}` : ""}`;

/** Достижения для общей очереди деканата: те же фильтры, что у заявок на документы. */
export async function getAchievementQueue(filter: QueueFilter = "active") {
  await requireRole("dean_office");
  const statuses = STATUSES[filter];
  const where: SQL | undefined = statuses ? inArray(achievements.status, [...statuses]) : undefined;

  const [rows, counts] = await Promise.all([
    statuses?.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: achievements.id,
            status: achievements.status,
            title: achievements.title,
            points: achievements.points,
            createdAt: achievements.createdAt,
            decidedAt: achievements.decidedAt,
            kind: achievementKinds.name,
            maxPoints: achievementKinds.maxPoints,
            lastName: users.lastName,
            firstName: users.firstName,
            middleName: users.middleName,
            group: groups.name,
          })
          .from(achievements)
          .innerJoin(achievementKinds, eq(achievementKinds.id, achievements.kindId))
          .innerJoin(users, eq(users.id, achievements.studentId))
          .innerJoin(studentProfiles, eq(studentProfiles.userId, achievements.studentId))
          .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
          .where(where)
          .orderBy(filter === "active" ? asc(achievements.createdAt) : desc(achievements.createdAt))
          .limit(200),
    db.select({ status: achievements.status, n: count() }).from(achievements).groupBy(achievements.status),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<Status, number>>;
  const total = (keys: readonly Status[] | null) =>
    (keys ?? (["pending", "approved", "rejected"] as const)).reduce((s, k) => s + (byStatus[k] ?? 0), 0);

  return {
    items: rows.map((r) => ({ ...r, student: studentName(r), updatedAt: r.decidedAt ?? r.createdAt })),
    counts: Object.fromEntries(Object.entries(STATUSES).map(([k, keys]) => [k, total(keys)])) as Record<QueueFilter, number>,
  };
}

/** Карточка достижения для деканата. null — если такого нет. */
export async function getAchievementForDean(achievementId: string) {
  await requireRole("dean_office");
  if (!UUID.test(achievementId)) return null;
  const [a] = await db
    .select({
      id: achievements.id,
      status: achievements.status,
      title: achievements.title,
      proofUrl: achievements.proofUrl,
      points: achievements.points,
      note: achievements.note,
      createdAt: achievements.createdAt,
      decidedAt: achievements.decidedAt,
      studentId: achievements.studentId,
      termId: achievements.termId,
      kind: achievementKinds.name,
      direction: achievementKinds.direction,
      maxPoints: achievementKinds.maxPoints,
      lastName: users.lastName,
      firstName: users.firstName,
      middleName: users.middleName,
      group: groups.name,
      course: groups.course,
      recordBook: studentProfiles.recordBookNumber,
      fileName: achievementFiles.name,
      fileSize: achievementFiles.size,
    })
    .from(achievements)
    .innerJoin(achievementKinds, eq(achievementKinds.id, achievements.kindId))
    .innerJoin(users, eq(users.id, achievements.studentId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, achievements.studentId))
    .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
    .leftJoin(achievementFiles, eq(achievementFiles.achievementId, achievements.id))
    .where(eq(achievements.id, achievementId));
  if (!a) return null;

  // Сколько уже засчитано в этом триместре: сверх предела баллы в рейтинг не идут.
  const [[approved], [settings]] = await Promise.all([
    db
      .select({ points: sum(achievements.points).mapWith(Number) })
      .from(achievements)
      .where(and(eq(achievements.studentId, a.studentId), eq(achievements.termId, a.termId), eq(achievements.status, "approved"))),
    db.select({ data: gradingSettings.data }).from(gradingSettings).where(eq(gradingSettings.key, "default")),
  ]);
  const s = settings?.data ?? DEFAULT_SETTINGS;

  return {
    ...a,
    student: studentName(a),
    approvedPoints: approved?.points ?? 0,
    pointsLimit: s.activityPointsMax,
    coefficient: s.activityCoefficient,
  };
}

export type DecisionResult = { ok: true; status: "approved" | "rejected" } | { ok: false; error: string };

/**
 * Решение по достижению: засчитать с баллами (от 1 до максимума вида) или отклонить с причиной.
 * Решить можно только то, что ещё на проверке. Студенту приходит уведомление, рейтинг пересчитывается сам.
 */
export async function decideAchievement(achievementId: string, input: DecisionInput): Promise<DecisionResult> {
  await requireRole("dean_office");
  if (!UUID.test(achievementId)) return { ok: false, error: "Достижение не найдено" };

  return db.transaction(async (tx) => {
    // FOR UPDATE: два сотрудника не решат одно достижение по-разному.
    const [a] = await tx
      .select({
        status: achievements.status,
        studentId: achievements.studentId,
        title: achievements.title,
        maxPoints: achievementKinds.maxPoints,
      })
      .from(achievements)
      .innerJoin(achievementKinds, eq(achievementKinds.id, achievements.kindId))
      .where(eq(achievements.id, achievementId))
      .for("update", { of: achievements });
    if (!a) return { ok: false, error: "Достижение не найдено" } as const;
    if (a.status !== "pending") return { ok: false, error: "По этому достижению уже принято решение. Обновите страницу" } as const;

    const checked = checkDecision(input, a.maxPoints);
    if (!checked.ok) return { ok: false, error: checked.error } as const;
    const d = checked.value;

    const now = new Date();
    await tx
      .update(achievements)
      .set({ status: d.status, points: d.points, note: d.note, decidedAt: now })
      .where(eq(achievements.id, achievementId));
    await tx.insert(notifications).values({
      userId: a.studentId,
      kind: "request",
      title: d.status === "approved" ? `Достижение засчитано: +${d.points}` : "Достижение отклонено",
      body: d.note ? `${a.title}. ${d.note}` : a.title,
      href: "/grades#achievements-title",
      createdAt: now,
    });
    return { ok: true, status: d.status } as const;
  });
}

/** Файл-подтверждение для проверки деканатом. null — если достижения или файла нет. */
export async function takeAchievementFileForDean(achievementId: string) {
  await requireRole("dean_office");
  if (!UUID.test(achievementId)) return null;
  const [file] = await db
    .select({ name: achievementFiles.name, mime: achievementFiles.mime, data: achievementFiles.data })
    .from(achievementFiles)
    .where(eq(achievementFiles.achievementId, achievementId));
  return file ?? null;
}
