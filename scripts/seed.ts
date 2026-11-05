// Наполняет базу вымышленными данными университета «Меридиан».
// Все ФИО, номера зачёток и структура придуманы. Совпадения случайны.
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

const password = process.env.SEED_PASSWORD ?? "";
if (password.length < 10) {
  console.error("Задай SEED_PASSWORD (не короче 10 символов) в .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: s });

async function main() {
  await db.transaction(async (tx) => {
    await tx.delete(s.loginAttempts);
    await tx.delete(s.sessions);
    await tx.delete(s.studentProfiles);
    await tx.delete(s.staffProfiles);
    await tx.delete(s.users);
    await tx.delete(s.groups);
    await tx.delete(s.programs);
    await tx.delete(s.faculties);

    const [fge, fmp] = await tx
      .insert(s.faculties)
      .values([
        { name: "Факультет глобальной экономики", shortName: "ФГЭ" },
        { name: "Факультет международной политики", shortName: "ФМП" },
      ])
      .returning();

    const [econ, polit] = await tx
      .insert(s.programs)
      .values([
        { facultyId: fge.id, code: "38.03.01", name: "Мировая экономика и торговля" },
        { facultyId: fmp.id, code: "41.03.05", name: "Международные отношения и дипломатия" },
      ])
      .returning();

    const [ge2, mp3] = await tx
      .insert(s.groups)
      .values([
        { programId: econ.id, name: "ГЭ-24-1", course: 2 },
        { programId: polit.id, name: "МП-23-2", course: 3 },
      ])
      .returning();

    const passwordHash = await hashPassword(password);

    const [student1, student2, teacher, dean] = await tx
      .insert(s.users)
      .values([
        { login: "student1", passwordHash, role: "student", lastName: "Северова", firstName: "Алина", middleName: "Игоревна" },
        { login: "student2", passwordHash, role: "student", lastName: "Ветров", firstName: "Матвей", middleName: "Андреевич" },
        { login: "teacher", passwordHash, role: "teacher", lastName: "Лазарева", firstName: "Ирина", middleName: "Олеговна" },
        { login: "dean", passwordHash, role: "dean_office", lastName: "Громов", firstName: "Денис", middleName: "Павлович" },
      ])
      .returning();

    await tx.insert(s.studentProfiles).values([
      { userId: student1.id, groupId: ge2.id, recordBookNumber: "М-24-0417", isPaid: true },
      { userId: student2.id, groupId: mp3.id, recordBookNumber: "М-23-1182", isPaid: false },
    ]);

    await tx.insert(s.staffProfiles).values([
      { userId: teacher.id, position: "Доцент кафедры мировой экономики", facultyId: fge.id },
      { userId: dean.id, position: "Специалист деканата", facultyId: null },
    ]);
  });

  console.log("Готово: student1, student2, teacher, dean. Пароль — SEED_PASSWORD из .env");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
