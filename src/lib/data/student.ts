import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { faculties, groups, programs, studentProfiles, users } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";

// Функции без параметра id: студент всегда берётся из сессии, поэтому чужие данные запросить нельзя.

export async function getMyProfile() {
  const user = await requireRole("student");

  const [row] = await db
    .select({
      lastName: users.lastName,
      firstName: users.firstName,
      middleName: users.middleName,
      recordBookNumber: studentProfiles.recordBookNumber,
      isPaid: studentProfiles.isPaid,
      group: groups.name,
      course: groups.course,
      programCode: programs.code,
      program: programs.name,
      faculty: faculties.name,
    })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
    .innerJoin(programs, eq(programs.id, groups.programId))
    .innerJoin(faculties, eq(faculties.id, programs.facultyId))
    .where(eq(studentProfiles.userId, user.id))
    .limit(1);

  if (!row) throw new Error("Профиль студента не найден");
  return row;
}
