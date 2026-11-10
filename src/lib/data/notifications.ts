import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";

// Уведомления студента. Всё, что принимает id, ищет его ТОЛЬКО среди уведомлений
// пользователя из сессии: чужое уведомление неотличимо от несуществующего.

export const NOTIFICATION_KINDS = ["score", "request", "change", "announcement"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Лента показывает последние уведомления; старше — не нужны для демо и не грузят телефон. */
const FEED_LIMIT = 100;

export const isNotificationKind = (v: unknown): v is NotificationKind =>
  typeof v === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(v);

/** Лента: последние уведомления, при фильтре — только этого типа. Плюс сколько непрочитанных каждого типа. */
export async function getMyNotifications(kind?: NotificationKind) {
  const user = await requireRole("student");
  const mine = eq(notifications.userId, user.id);
  const [items, unreadByKind] = await Promise.all([
    db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(kind ? and(mine, eq(notifications.kind, kind)) : mine)
      .orderBy(desc(notifications.createdAt))
      .limit(FEED_LIMIT),
    db
      .select({ kind: notifications.kind, n: count() })
      .from(notifications)
      .where(and(mine, isNull(notifications.readAt)))
      .groupBy(notifications.kind),
  ]);
  const unread = Object.fromEntries(unreadByKind.map((r) => [r.kind, r.n])) as Partial<Record<NotificationKind, number>>;
  return { items, unread, unreadTotal: unreadByKind.reduce((s, r) => s + r.n, 0) };
}

/**
 * Открыть уведомление: отметить прочитанным и вернуть, куда вести.
 * null — если уведомления нет или оно чужое (маршрут отдаст 404).
 */
export async function openMyNotification(notificationId: string): Promise<{ href: string } | null> {
  const user = await requireRole("student");
  if (!UUID.test(notificationId)) return null;
  const [row] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)))
    .returning({ href: notifications.href });
  if (!row) return null;
  // Ссылка из базы ведёт только внутрь кабинета: внешний адрес сюда попасть не должен.
  return { href: row.href?.startsWith("/") && !row.href.startsWith("//") ? row.href : "/notifications" };
}

/** Отметить прочитанными все уведомления (или только одного типа, если открыт фильтр). */
export async function markAllMyNotificationsRead(kind?: NotificationKind) {
  const user = await requireRole("student");
  const unread = and(eq(notifications.userId, user.id), isNull(notifications.readAt));
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(kind ? and(unread, eq(notifications.kind, kind)) : unread);
}

/**
 * Короткое состояние для обновления без перезагрузки: число непрочитанных и самое новое уведомление.
 * Клиент опрашивает его раз в несколько секунд и перерисовывает страницу, только если что-то изменилось.
 */
export async function getMyNotificationState() {
  const user = await requireRole("student");
  const mine = eq(notifications.userId, user.id);
  const [[unread], [latest]] = await Promise.all([
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(mine, isNull(notifications.readAt))),
    db
      .select({ id: notifications.id, title: notifications.title, readAt: notifications.readAt })
      .from(notifications)
      .where(mine)
      .orderBy(desc(notifications.createdAt))
      .limit(1),
  ]);
  return {
    unread: unread?.n ?? 0,
    latest: latest ? { id: latest.id, title: latest.title, unread: latest.readAt === null } : null,
  };
}
