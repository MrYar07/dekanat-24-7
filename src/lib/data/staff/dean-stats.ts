import "server-only";
import { and, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { achievements, checkpointScores, documentTypes, issuedDocuments, requestEvents, requests } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";

// Сводка для деканата: что кабинет изменил по сравнению с бумажным порядком.
// Только счётчики по всем студентам, без персональных данных. Роль проверяет сама функция.

/** Сколько походов в деканат экономит мгновенная справка: попросить, забрать, поставить печать. */
export const VISITS_SAVED_INSTANT = 3;
/** Заявка с печатью: остаётся один поход — забрать готовое. */
export const VISITS_SAVED_REQUEST = 2;

export async function getDeanStats(at: Date = new Date()) {
  await requireRole("dean_office");
  const weekAgo = new Date(at.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [[issued], byType, [handled], [speed], [scores], achievementRows] = await Promise.all([
    db.select({ n: count() }).from(issuedDocuments),
    db
      .select({ name: documentTypes.name, instant: documentTypes.instant, n: count() })
      .from(requests)
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      .groupBy(documentTypes.name, documentTypes.instant)
      .orderBy(desc(count())),
    db
      .select({ n: count() })
      .from(requests)
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      .where(and(eq(documentTypes.instant, false), inArray(requests.status, ["ready", "issued"]))),
    // От подачи до «готово», в часах: только заявки, которые ведёт деканат.
    db
      .select({
        hours: sql<number | null>`avg(extract(epoch from (${requestEvents.createdAt} - ${requests.createdAt})) / 3600)`.mapWith(Number),
        n: count(),
      })
      .from(requestEvents)
      .innerJoin(requests, eq(requests.id, requestEvents.requestId))
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      .where(and(eq(requestEvents.status, "ready"), eq(documentTypes.instant, false))),
    db.select({ n: count() }).from(checkpointScores).where(gte(checkpointScores.gradedAt, weekAgo)),
    db
      .select({ status: achievements.status, n: count(), points: sum(achievements.points).mapWith(Number) })
      .from(achievements)
      .groupBy(achievements.status),
  ]);

  const instant = issued?.n ?? 0;
  const closed = handled?.n ?? 0;
  const achievement = (status: "pending" | "approved" | "rejected") => achievementRows.find((r) => r.status === status);

  return {
    visitsSaved: instant * VISITS_SAVED_INSTANT + closed * VISITS_SAVED_REQUEST,
    instant,
    closed,
    /** Среднее время от подачи до «готово» в часах. null — готовых заявок ещё не было. */
    hoursToReady: speed && speed.n > 0 && speed.hours !== null ? speed.hours : null,
    scoresThisWeek: scores?.n ?? 0,
    byType: byType.map((t) => ({ name: t.name, instant: t.instant, count: t.n })),
    achievements: {
      pending: achievement("pending")?.n ?? 0,
      approved: achievement("approved")?.n ?? 0,
      rejected: achievement("rejected")?.n ?? 0,
      points: achievement("approved")?.points ?? 0,
    },
  };
}
