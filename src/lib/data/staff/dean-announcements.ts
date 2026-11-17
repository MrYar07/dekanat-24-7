import "server-only";
import { and, asc, count, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { announcements, groups, notifications, studentProfiles } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";

// Деканат: объявления для всех студентов или для одной группы.
// Опубликованное объявление студенты видят на «Сегодня» и получают о нём уведомление.
// Опечатку можно поправить: текст меняется и в объявлении, и в уже отправленных уведомлениях.
// Ошибочное объявление можно снять: оно пропадает у студентов вместе с уведомлениями.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TITLE_MAX = 120;
export const BODY_MAX = 800;
/** Защита демо от спама: не больше стольких объявлений в сутки. */
const DAILY_LIMIT = 20;

/** Доска объявлений деканата: последние объявления и список групп для выбора адресата. */
export async function getAnnouncementBoard() {
  await requireRole("dean_office");
  const [items, groupRows] = await Promise.all([
    db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        publishedAt: announcements.publishedAt,
        editedAt: announcements.editedAt,
        withdrawnAt: announcements.withdrawnAt,
        group: groups.name,
      })
      .from(announcements)
      .leftJoin(groups, eq(groups.id, announcements.groupId))
      .orderBy(desc(announcements.publishedAt))
      .limit(30),
    db.select({ id: groups.id, name: groups.name }).from(groups).orderBy(asc(groups.name)),
  ]);
  return { items, groups: groupRows };
}

export type AnnouncementInput = { title: string; body: string; audience: string };
type Fields = Partial<Record<keyof AnnouncementInput, string>>;
export type AnnouncementResult = { ok: true; recipients: number } | { ok: false; error: string; fields?: Fields };

/** Начало текста для уведомления. */
const preview = (body: string) => (body.length > 140 ? `${body.slice(0, 139).trimEnd()}…` : body);

function checkText(input: { title: string; body: string }) {
  const title = input.title.trim();
  const body = input.body.trim();
  const fields: Fields = {};
  if (title.length < 3) fields.title = "Нужен заголовок";
  else if (title.length > TITLE_MAX) fields.title = `Не длиннее ${TITLE_MAX} знаков`;
  if (body.length < 3) fields.body = "Нужен текст объявления";
  else if (body.length > BODY_MAX) fields.body = `Не длиннее ${BODY_MAX} знаков`;
  return { title, body, fields };
}

/** Опубликовать объявление. audience — «all» или id группы. Каждому адресату уходит уведомление. */
export async function publishAnnouncement(input: AnnouncementInput): Promise<AnnouncementResult> {
  await requireRole("dean_office");
  const { title, body, fields } = checkText(input);
  if (input.audience !== "all" && !UUID.test(input.audience)) fields.audience = "Нужно выбрать, кому";
  if (Object.keys(fields).length) return { ok: false, error: "Проверьте поля формы", fields };

  return db.transaction(async (tx) => {
    const groupId = input.audience === "all" ? null : input.audience;
    if (groupId) {
      const [g] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId));
      if (!g) return { ok: false, error: "Проверьте поля формы", fields: { audience: "Такой группы нет" } } as const;
    }
    const [today] = await tx
      .select({ n: count() })
      .from(announcements)
      .where(gte(announcements.publishedAt, new Date(Date.now() - 24 * 3_600_000)));
    if ((today?.n ?? 0) >= DAILY_LIMIT) {
      return { ok: false, error: "За сутки уже опубликовано много объявлений. Это ограничение демо-версии." } as const;
    }

    const now = new Date();
    const [created] = await tx
      .insert(announcements)
      .values({ title, body, groupId, publishedAt: now })
      .returning({ id: announcements.id });
    const recipients = await tx
      .select({ id: studentProfiles.userId })
      .from(studentProfiles)
      .where(groupId ? eq(studentProfiles.groupId, groupId) : undefined);
    if (recipients.length) {
      await tx.insert(notifications).values(
        recipients.map((r) => ({
          userId: r.id,
          kind: "announcement" as const,
          title,
          body: preview(body),
          href: "/",
          announcementId: created.id,
          createdAt: now,
        })),
      );
    }
    return { ok: true, recipients: recipients.length } as const;
  });
}

export type EditResult = { ok: true } | { ok: false; error: string; fields?: Fields };

/**
 * Поправить заголовок или текст. Адресаты не меняются, повторного уведомления нет:
 * у тех, кто уже получил уведомление, оно просто показывает новый текст.
 */
export async function editAnnouncement(announcementId: string, input: { title: string; body: string }): Promise<EditResult> {
  await requireRole("dean_office");
  if (!UUID.test(announcementId)) return { ok: false, error: "Объявление не найдено" };
  const { title, body, fields } = checkText(input);
  if (Object.keys(fields).length) return { ok: false, error: "Проверьте поля формы", fields };

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(announcements)
      .set({ title, body, editedAt: new Date() })
      .where(and(eq(announcements.id, announcementId), isNull(announcements.withdrawnAt)))
      .returning({ id: announcements.id });
    if (!updated) return { ok: false, error: "Объявление не найдено или уже снято" } as const;
    await tx.update(notifications).set({ title, body: preview(body) }).where(eq(notifications.announcementId, announcementId));
    return { ok: true } as const;
  });
}

export type WithdrawResult = { ok: true; removed: number } | { ok: false; error: string };

/** Снять объявление: студенты его больше не видят, уведомления о нём удаляются. У деканата остаётся с пометкой. */
export async function withdrawAnnouncement(announcementId: string): Promise<WithdrawResult> {
  await requireRole("dean_office");
  if (!UUID.test(announcementId)) return { ok: false, error: "Объявление не найдено" };

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(announcements)
      .set({ withdrawnAt: new Date() })
      .where(and(eq(announcements.id, announcementId), isNull(announcements.withdrawnAt)))
      .returning({ id: announcements.id });
    if (!updated) return { ok: false, error: "Объявление не найдено или уже снято" } as const;
    const removed = await tx
      .delete(notifications)
      .where(eq(notifications.announcementId, announcementId))
      .returning({ id: notifications.id });
    return { ok: true, removed: removed.length } as const;
  });
}
