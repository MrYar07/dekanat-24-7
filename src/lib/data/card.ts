import "server-only";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { faculties, groups, programs, studentCardTokens, studentProfiles, terms, users } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { isCardToken, MAX_TOKENS_PER_MINUTE, TOKEN_TTL_MS, validUntil } from "@/lib/card";
import { maskName, newVerificationCode } from "@/lib/documents";

// Электронный студенческий. Свои функции берут студента из сессии; проверка по QR — публичная,
// и отдаёт только то, что видно на обычном студенческом: фамилию с инициалами, факультет, курс, срок.

async function currentYear() {
  const [term] = await db.select({ academicYear: terms.academicYear }).from(terms).where(eq(terms.isCurrent, true)).limit(1);
  return term ? validUntil(term.academicYear) : null;
}

/** Данные для лицевой стороны студенческого. */
export async function getMyCard() {
  const user = await requireRole("student");
  const [[row], until] = await Promise.all([
    db
      .select({
        lastName: users.lastName,
        firstName: users.firstName,
        middleName: users.middleName,
        recordBookNumber: studentProfiles.recordBookNumber,
        group: groups.name,
        course: groups.course,
        program: programs.name,
        faculty: faculties.name,
      })
      .from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
      .innerJoin(programs, eq(programs.id, groups.programId))
      .innerJoin(faculties, eq(faculties.id, programs.facultyId))
      .where(eq(studentProfiles.userId, user.id))
      .limit(1),
    currentYear(),
  ]);
  if (!row) throw new Error("Профиль студента не найден");
  return { ...row, validUntil: until };
}

/**
 * Новый одноразовый код для QR. Старые коды этого студента, которые уже истекли, удаляются:
 * таблица не растёт, а снимок экрана недельной давности превращается в «не найден».
 * null — слишком часто (больше MAX_TOKENS_PER_MINUTE за минуту).
 */
export async function issueMyCardToken(at: Date = new Date()) {
  const user = await requireRole("student");
  return db.transaction(async (tx) => {
    await tx
      .delete(studentCardTokens)
      .where(and(eq(studentCardTokens.studentId, user.id), lt(studentCardTokens.expiresAt, new Date(at.getTime() - TOKEN_TTL_MS))));
    const [recent] = await tx
      .select({ n: count() })
      .from(studentCardTokens)
      .where(and(eq(studentCardTokens.studentId, user.id), gte(studentCardTokens.createdAt, new Date(at.getTime() - 60_000))));
    if ((recent?.n ?? 0) >= MAX_TOKENS_PER_MINUTE) return null;

    const token = newVerificationCode();
    const expiresAt = new Date(at.getTime() + TOKEN_TTL_MS);
    await tx.insert(studentCardTokens).values({ token, studentId: user.id, expiresAt, createdAt: at });
    return { token, expiresAt };
  });
}

/** Публичная проверка по QR. null — кода нет (или он давно удалён). fresh = false — код уже истёк. */
export async function verifyStudentCard(token: string, at: Date = new Date()) {
  if (!isCardToken(token)) return null;
  const [row] = await db
    .select({
      expiresAt: studentCardTokens.expiresAt,
      lastName: users.lastName,
      firstName: users.firstName,
      middleName: users.middleName,
      course: groups.course,
      faculty: faculties.name,
    })
    .from(studentCardTokens)
    .innerJoin(users, eq(users.id, studentCardTokens.studentId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
    .innerJoin(programs, eq(programs.id, groups.programId))
    .innerJoin(faculties, eq(faculties.id, programs.facultyId))
    .where(eq(studentCardTokens.token, token))
    .limit(1);
  if (!row) return null;
  return {
    fresh: row.expiresAt.getTime() > at.getTime(),
    holder: maskName(row.lastName, row.firstName, row.middleName),
    course: row.course,
    faculty: row.faculty,
    validUntil: await currentYear(),
  };
}
