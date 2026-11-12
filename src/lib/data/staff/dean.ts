import "server-only";
import { and, asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  documentTypes,
  groups,
  issuedDocuments,
  notifications,
  requestEvents,
  requests,
  studentProfiles,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";

// Деканат: очередь заявок всех студентов и смена статуса. Функции сами проверяют роль:
// студент или преподаватель сюда не попадут, даже если вызовут функцию напрямую.

type Status = (typeof requests.$inferSelect)["status"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const QUEUE_FILTERS = {
  active: { label: "Ждут", statuses: ["submitted", "in_review"] },
  ready: { label: "Готовы", statuses: ["ready"] },
  done: { label: "Закрыты", statuses: ["issued", "rejected"] },
  all: { label: "Все", statuses: null },
} as const satisfies Record<string, { label: string; statuses: readonly Status[] | null }>;
export type QueueFilter = keyof typeof QUEUE_FILTERS;
export const isQueueFilter = (v: unknown): v is QueueFilter => typeof v === "string" && v in QUEUE_FILTERS;

/** Куда можно перевести заявку из каждого статуса. Мгновенные справки деканат не ведёт: их выдаёт система. */
export const NEXT_STATUSES: Record<Status, Status[]> = {
  submitted: ["in_review", "rejected"],
  in_review: ["ready", "rejected"],
  ready: ["issued"],
  issued: [],
  rejected: [],
};

const studentName = (u: { lastName: string; firstName: string; middleName: string | null }) =>
  `${u.lastName} ${u.firstName}${u.middleName ? ` ${u.middleName}` : ""}`;

/** Очередь: «ждут» — старые сверху (кто раньше подал, тот раньше получит), остальное — новые сверху. */
export async function getRequestQueue(filter: QueueFilter = "active") {
  await requireRole("dean_office");
  const statuses = QUEUE_FILTERS[filter].statuses;
  const where: SQL | undefined = statuses ? inArray(requests.status, [...statuses]) : undefined;

  const [rows, counts] = await Promise.all([
    db
      .select({
        id: requests.id,
        status: requests.status,
        createdAt: requests.createdAt,
        updatedAt: requests.updatedAt,
        type: documentTypes.name,
        instant: documentTypes.instant,
        days: documentTypes.days,
        lastName: users.lastName,
        firstName: users.firstName,
        middleName: users.middleName,
        group: groups.name,
      })
      .from(requests)
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      .innerJoin(users, eq(users.id, requests.studentId))
      .innerJoin(studentProfiles, eq(studentProfiles.userId, requests.studentId))
      .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
      .where(where)
      .orderBy(filter === "active" ? asc(requests.createdAt) : desc(requests.updatedAt))
      .limit(200),
    db.select({ status: requests.status, n: count() }).from(requests).groupBy(requests.status),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<Status, number>>;
  const total = (keys: readonly Status[] | null) =>
    (keys ?? (Object.keys(NEXT_STATUSES) as Status[])).reduce((s, k) => s + (byStatus[k] ?? 0), 0);

  return {
    items: rows.map((r) => ({ ...r, student: studentName(r) })),
    counts: Object.fromEntries(Object.entries(QUEUE_FILTERS).map(([k, f]) => [k, total(f.statuses)])) as Record<
      QueueFilter,
      number
    >,
  };
}

/** Карточка заявки для деканата. null — если такой заявки нет. */
export async function getRequestForDean(requestId: string) {
  await requireRole("dean_office");
  if (!UUID.test(requestId)) return null;
  const [r] = await db
    .select({
      id: requests.id,
      status: requests.status,
      payload: requests.payload,
      createdAt: requests.createdAt,
      type: documentTypes.name,
      instant: documentTypes.instant,
      days: documentTypes.days,
      lastName: users.lastName,
      firstName: users.firstName,
      middleName: users.middleName,
      group: groups.name,
      course: groups.course,
      recordBook: studentProfiles.recordBookNumber,
    })
    .from(requests)
    .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
    .innerJoin(users, eq(users.id, requests.studentId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, requests.studentId))
    .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
    .where(eq(requests.id, requestId));
  if (!r) return null;

  const [events, [doc]] = await Promise.all([
    db
      .select({ status: requestEvents.status, note: requestEvents.note, createdAt: requestEvents.createdAt })
      .from(requestEvents)
      .where(eq(requestEvents.requestId, r.id))
      .orderBy(asc(requestEvents.createdAt)),
    db.select({ number: issuedDocuments.number }).from(issuedDocuments).where(eq(issuedDocuments.requestId, r.id)),
  ]);

  return {
    ...r,
    student: studentName(r),
    events,
    hasDocument: Boolean(doc),
    next: r.instant ? [] : NEXT_STATUSES[r.status],
  };
}

export type StatusChange = { status: string; note: string };
export type StatusChangeResult = { ok: true } | { ok: false; error: string };

const NOTE_MAX = 300;

/** Что увидит студент в уведомлении. */
function notificationFor(status: Status, type: string, note: string | null) {
  switch (status) {
    case "in_review":
      return { title: `Заявка в работе: ${type}`, body: note ?? "Деканат начал готовить документ" };
    case "ready":
      return { title: `Готово: ${type}`, body: note ?? "Документ готов" };
    case "issued":
      return { title: `Выдано: ${type}`, body: note ?? "Документ выдан" };
    case "rejected":
      return { title: `Заявка отклонена: ${type}`, body: note ?? "" };
    default:
      return { title: type, body: note ?? "" };
  }
}

/**
 * Перевести заявку в следующий статус. Допустимы только переходы из NEXT_STATUSES;
 * отказ — только с причиной. Студенту приходит уведомление со ссылкой на заявку.
 */
export async function changeRequestStatus(requestId: string, change: StatusChange): Promise<StatusChangeResult> {
  await requireRole("dean_office");
  if (!UUID.test(requestId)) return { ok: false, error: "Заявка не найдена" };
  const note = change.note.trim().slice(0, NOTE_MAX) || null;
  if (change.status === "rejected" && !note) return { ok: false, error: "Нужна причина отказа: её увидит студент" };

  return db.transaction(async (tx) => {
    // FOR UPDATE: два сотрудника не переведут одну заявку одновременно в разные статусы.
    const [r] = await tx
      .select({ status: requests.status, studentId: requests.studentId, type: documentTypes.name, instant: documentTypes.instant })
      .from(requests)
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      .where(eq(requests.id, requestId))
      .for("update", { of: requests });
    if (!r) return { ok: false, error: "Заявка не найдена" } as const;

    const allowed = r.instant ? [] : NEXT_STATUSES[r.status];
    const target = allowed.find((s) => s === change.status);
    if (!target) return { ok: false, error: "Статус этой заявки уже изменили. Обновите страницу" } as const;

    const now = new Date();
    await tx.update(requests).set({ status: target, updatedAt: now }).where(eq(requests.id, requestId));
    await tx.insert(requestEvents).values({ requestId, status: target, note, createdAt: now });
    const n = notificationFor(target, r.type, note);
    await tx.insert(notifications).values({
      userId: r.studentId,
      kind: "request",
      title: n.title,
      body: n.body || null,
      href: `/requests/${requestId}`,
      createdAt: now,
    });
    return { ok: true } as const;
  });
}

/** Для шапки очереди: сколько заявок ждут. */
export async function getWaitingCount() {
  await requireRole("dean_office");
  const [row] = await db
    .select({ n: count() })
    .from(requests)
    .where(and(inArray(requests.status, ["submitted", "in_review"])));
  return row?.n ?? 0;
}
