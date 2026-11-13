import "server-only";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { achievementFiles, achievementKinds, achievements, terms } from "@/db/schema";
import { checkSubmission, type SubmissionField, type SubmissionInput } from "@/lib/achievements";
import { requireRole } from "@/lib/auth/dal";

// Достижения студента для бонуса активности: подача заявки и свой файл-подтверждение.
// Список достижений с баллами отдаёт getGrades() из learning.ts. Студент — только из сессии.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Защита демо от спама и от заполнения базы файлами: не больше стольких заявок в сутки. */
const DAILY_LIMIT = 5;

/** Справочник видов достижений: что можно подать и сколько баллов за это дают. */
export async function getAchievementKinds() {
  await requireRole("student");
  return db
    .select({
      id: achievementKinds.id,
      direction: achievementKinds.direction,
      name: achievementKinds.name,
      maxPoints: achievementKinds.maxPoints,
    })
    .from(achievementKinds)
    .orderBy(asc(achievementKinds.direction), desc(achievementKinds.maxPoints));
}

export type SubmitResult = { ok: true } | { ok: false; error?: string; fields?: Partial<Record<SubmissionField, string>> };

/** Подать достижение на проверку в деканат. Записывается в текущий триместр студента из сессии. */
export async function submitMyAchievement(input: SubmissionInput): Promise<SubmitResult> {
  const user = await requireRole("student");
  const checked = checkSubmission(input);
  if (!checked.ok) return { ok: false, fields: checked.fields };
  const a = checked.value;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [[term], [kind], [recent]] = await Promise.all([
    db.select({ id: terms.id }).from(terms).where(eq(terms.isCurrent, true)).limit(1),
    db.select({ id: achievementKinds.id }).from(achievementKinds).where(eq(achievementKinds.id, a.kind)),
    db
      .select({ n: count() })
      .from(achievements)
      .where(and(eq(achievements.studentId, user.id), gte(achievements.createdAt, dayAgo))),
  ]);
  if (!term) return { ok: false, error: "Сейчас нет триместра, в который можно записать достижение" };
  if (!kind) return { ok: false, fields: { kind: "Такого вида достижения нет в справочнике" } };
  if ((recent?.n ?? 0) >= DAILY_LIMIT) {
    return { ok: false, error: `За сутки можно подать не больше ${DAILY_LIMIT} достижений. Попробуй завтра` };
  }

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(achievements)
      .values({ studentId: user.id, termId: term.id, kindId: kind.id, title: a.title, proofUrl: a.proofUrl })
      .returning({ id: achievements.id });
    if (a.file) {
      await tx.insert(achievementFiles).values({
        achievementId: row.id,
        name: a.file.name,
        mime: a.file.mime,
        size: a.file.bytes.length,
        data: Buffer.from(a.file.bytes),
      });
    }
  });
  return { ok: true };
}

/** Файл-подтверждение своего достижения. Чужое достижение неотличимо от несуществующего: null → 404. */
export async function takeMyAchievementFile(achievementId: string) {
  const user = await requireRole("student");
  if (!UUID.test(achievementId)) return null;
  const [file] = await db
    .select({ name: achievementFiles.name, mime: achievementFiles.mime, data: achievementFiles.data })
    .from(achievementFiles)
    .innerJoin(achievements, eq(achievements.id, achievementFiles.achievementId))
    .where(and(eq(achievementFiles.achievementId, achievementId), eq(achievements.studentId, user.id)));
  return file ?? null;
}
