// Наполняет базу вымышленными данными университета «Меридиан».
// Все ФИО, номера зачёток, дисциплины и оценки придуманы. Совпадения случайны.
//
// Все даты считаются от «сейчас»: триместр начался 8 недель назад, поэтому сегодня всегда 9-я неделя,
// второй срез только что прошёл, третий — через две недели. Демо не устаревает, сколько бы его ни открывали.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { DEFAULT_SETTINGS, attendancePercent, ratingForecast } from "../src/lib/grading";
import { addDays, formatDay, mondayOf, mskInstant, mskNow, weekdayOf } from "../src/lib/time";

const password = process.env.SEED_PASSWORD ?? "";
if (password.length < 10) {
  console.error("Задай SEED_PASSWORD (не короче 10 символов) в .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: s });

// Детерминированный генератор: при каждом запуске одни и те же «случайные» пропуски.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAIRS: Record<string, string> = {
  "09:30": "11:00",
  "11:10": "12:40",
  "13:00": "14:30",
  "14:50": "16:20",
  "16:40": "18:10",
};

type SlotSpec = [weekday: number, startsAt: string, room: string, kind: "lecture" | "seminar"];
type CourseSpec = {
  discipline: string;
  teacher: string;
  assessment: "exam" | "credit";
  slots: SlotSpec[];
  /** Баллы за срезы 1 и 2; null — второй ещё не проверен. */
  scores: [number, number | null];
  bonus?: number;
};

// ГЭ-24-1, Алина Северова: сильная студентка, годовой рейтинг чуть-чуть не дотягивает до гранта.
const GE_COURSES: CourseSpec[] = [
  { discipline: "Макроэкономика", teacher: "Лазарева", assessment: "exam", slots: [[1, "11:10", "ауд. 412", "seminar"], [3, "09:30", "ауд. 101", "lecture"]], scores: [86, 92], bonus: 1 },
  { discipline: "Мировая экономика", teacher: "Орлов", assessment: "exam", slots: [[1, "13:00", "ауд. 218", "lecture"], [4, "11:10", "ауд. 218", "seminar"]], scores: [84, 92] },
  { discipline: "Эконометрика", teacher: "Белова", assessment: "credit", slots: [[2, "11:10", "ауд. 305", "seminar"], [5, "09:30", "ауд. 101", "lecture"]], scores: [81, 87] },
  { discipline: "Английский язык", teacher: "Ким", assessment: "credit", slots: [[1, "14:50", "ауд. 507", "seminar"], [4, "14:50", "ауд. 507", "seminar"]], scores: [94, 91] },
  { discipline: "Международные финансы", teacher: "Сафонова", assessment: "exam", slots: [[2, "13:00", "ауд. 120", "lecture"], [5, "11:10", "ауд. 314", "seminar"]], scores: [80, 85] },
  { discipline: "Право ВТО", teacher: "Демидов", assessment: "credit", slots: [[3, "11:10", "ауд. 210", "seminar"]], scores: [88, null] },
];

// МП-23-2, Матвей Ветров: середнячок, по английскому не хватает совсем немного до автомата.
const MP_COURSES: CourseSpec[] = [
  { discipline: "История дипломатии", teacher: "Демидов", assessment: "exam", slots: [[1, "09:30", "ауд. 101", "lecture"], [3, "13:00", "ауд. 225", "seminar"]], scores: [72, 68] },
  { discipline: "Теория международных отношений", teacher: "Ромашова", assessment: "exam", slots: [[1, "11:10", "ауд. 309", "seminar"], [4, "09:30", "ауд. 120", "lecture"]], scores: [65, 74] },
  { discipline: "Международное право", teacher: "Белова", assessment: "exam", slots: [[2, "09:30", "ауд. 101", "lecture"], [5, "11:10", "ауд. 225", "seminar"]], scores: [70, 62] },
  { discipline: "Английский язык", teacher: "Ким", assessment: "credit", slots: [[2, "13:00", "ауд. 507", "seminar"], [4, "13:00", "ауд. 507", "seminar"]], scores: [76, 70] },
  { discipline: "Региональные конфликты", teacher: "Ромашова", assessment: "credit", slots: [[3, "14:50", "ауд. 309", "seminar"]], scores: [80, 77] },
  { discipline: "Дипломатический протокол", teacher: "Голубева", assessment: "credit", slots: [[5, "13:00", "ауд. 412", "seminar"]], scores: [60, 71] },
];

const TEACHERS: Record<string, { lastName: string; firstName: string; middleName: string; login: string; position: string }> = {
  Лазарева: { lastName: "Лазарева", firstName: "Ирина", middleName: "Олеговна", login: "teacher", position: "Доцент кафедры мировой экономики" },
  Орлов: { lastName: "Орлов", firstName: "Кирилл", middleName: "Семёнович", login: "t-orlov", position: "Профессор кафедры мировой экономики" },
  Белова: { lastName: "Белова", firstName: "Наталья", middleName: "Викторовна", login: "t-belova", position: "Доцент кафедры количественных методов" },
  Ким: { lastName: "Ким", firstName: "Артур", middleName: "Валерьевич", login: "t-kim", position: "Старший преподаватель кафедры английского языка" },
  Сафонова: { lastName: "Сафонова", firstName: "Елена", middleName: "Петровна", login: "t-safonova", position: "Доцент кафедры финансов" },
  Демидов: { lastName: "Демидов", firstName: "Глеб", middleName: "Романович", login: "t-demidov", position: "Доцент кафедры международного права" },
  Ромашова: { lastName: "Ромашова", firstName: "Ольга", middleName: "Сергеевна", login: "t-romashova", position: "Профессор кафедры теории международных отношений" },
  Голубева: { lastName: "Голубева", firstName: "Вера", middleName: "Андреевна", login: "t-golubeva", position: "Старший преподаватель кафедры дипломатии" },
};

const ACHIEVEMENT_KINDS = [
  { key: "journal", direction: "Наука", name: "Статья в научном журнале", maxPoints: 100 },
  { key: "conference", direction: "Наука", name: "Статья в сборнике, доклад на конференции", maxPoints: 60 },
  { key: "contest", direction: "Наука", name: "Участие в конкурсе научных работ", maxPoints: 50 },
  { key: "art", direction: "Творчество и медиа", name: "Выступление на межвузовском конкурсе", maxPoints: 40 },
  { key: "media", direction: "Творчество и медиа", name: "Материалы для студенческих медиа (за триместр)", maxPoints: 20 },
  { key: "sport", direction: "Спорт", name: "Соревнование за сборную университета", maxPoints: 40 },
  { key: "lead", direction: "Сообщество", name: "Руководство студенческой организацией (за триместр)", maxPoints: 80 },
  { key: "organize", direction: "Сообщество", name: "Организация мероприятия", maxPoints: 50 },
  { key: "help", direction: "Сообщество", name: "Помощь в проведении мероприятия", maxPoints: 30 },
] as const;

const DOCUMENT_TYPES = [
  { code: "study", name: "Справка об обучении", instant: true, days: null, description: "Подтверждает, что ты учишься в «Меридиане». Для работы, банка, визы, соцзащиты. Готова сразу, с QR-кодом для проверки." },
  { code: "rating", name: "Выписка рейтинга", instant: true, days: null, description: "Рейтинг за триместр и год с расшифровкой. Для стажировок и конкурсов. Готова сразу." },
  { code: "scholarship", name: "Справка о размере стипендии", instant: false, days: 2, description: "Сумма стипендии за выбранный период. Готовит бухгалтерия, до 2 рабочих дней." },
  { code: "academic", name: "Академическая справка", instant: false, days: 5, description: "Все дисциплины и оценки за время обучения. Для перевода в другой вуз. До 5 рабочих дней." },
  { code: "recredit", name: "Заявление на перезачёт дисциплины", instant: false, days: 5, description: "Перезачёт дисциплины, изученной в другом вузе или на онлайн-курсе. Рассматривает деканат, до 5 рабочих дней." },
] as const;

const now = new Date();
const today = mskNow(now).date;
const termStart = addDays(mondayOf(today), -56);
const yesterday = addDays(today, -1);
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

/** Первая дата не раньше from с нужным днём недели. */
function nextWeekday(weekday: number, from: string) {
  return addDays(from, (weekday - weekdayOf(from) + 7) % 7);
}

async function main() {
  const studentRatings: string[] = [];

  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE
      notifications, announcements, request_events, requests, document_types,
      achievements, achievement_kinds, grading_settings,
      course_results, attendance, checkpoint_scores, checkpoints, lesson_changes, timetable_slots, courses, disciplines, terms,
      login_attempts, sessions, student_profiles, staff_profiles, users, groups, programs, faculties
      RESTART IDENTITY CASCADE`);

    // Структура

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

    await tx.insert(s.gradingSettings).values({ key: "default", data: DEFAULT_SETTINGS });

    // Люди. У преподавателей, кроме teacher, случайный пароль: войти под ними нельзя.

    const passwordHash = await hashPassword(password);
    const lockedHash = await hashPassword(randomBytes(32).toString("hex"));

    const [student1, student2, dean] = await tx
      .insert(s.users)
      .values([
        { login: "student1", passwordHash, role: "student", lastName: "Северова", firstName: "Алина", middleName: "Игоревна" },
        { login: "student2", passwordHash, role: "student", lastName: "Ветров", firstName: "Матвей", middleName: "Андреевич" },
        { login: "dean", passwordHash, role: "dean_office", lastName: "Громов", firstName: "Денис", middleName: "Павлович" },
      ])
      .returning();

    const teacherIds: Record<string, string> = {};
    for (const [key, t] of Object.entries(TEACHERS)) {
      const [u] = await tx
        .insert(s.users)
        .values({
          login: t.login,
          passwordHash: t.login === "teacher" ? passwordHash : lockedHash,
          role: "teacher",
          lastName: t.lastName,
          firstName: t.firstName,
          middleName: t.middleName,
        })
        .returning();
      teacherIds[key] = u.id;
      await tx.insert(s.staffProfiles).values({ userId: u.id, position: t.position, facultyId: fge.id });
    }

    await tx.insert(s.studentProfiles).values([
      { userId: student1.id, groupId: ge2.id, recordBookNumber: "М-24-0417", isPaid: true },
      { userId: student2.id, groupId: mp3.id, recordBookNumber: "М-23-1182", isPaid: false },
    ]);
    await tx.insert(s.staffProfiles).values({ userId: dean.id, position: "Специалист деканата", facultyId: null });

    // Триместр и дисциплины

    const [term] = await tx
      .insert(s.terms)
      .values({ name: "1-й триместр", startsOn: termStart, weeks: 12, isCurrent: true })
      .returning();

    const disciplineIds = new Map<string, string>();
    for (const name of new Set([...GE_COURSES, ...MP_COURSES].map((c) => c.discipline))) {
      const [d] = await tx.insert(s.disciplines).values({ name }).returning();
      disciplineIds.set(name, d.id);
    }

    type Seeded = { spec: CourseSpec; courseId: string; slotIds: { id: string; weekday: number }[] };

    async function seedGroup(groupId: string, studentId: string, specs: CourseSpec[], presentRate: number, seed: number) {
      const random = rng(seed);
      const seeded: Seeded[] = [];
      const forecastInputs = [];

      for (const [i, spec] of specs.entries()) {
        const [course] = await tx
          .insert(s.courses)
          .values({
            disciplineId: disciplineIds.get(spec.discipline)!,
            groupId,
            termId: term.id,
            teacherId: teacherIds[spec.teacher],
            assessment: spec.assessment,
            plannedCheckpoints: 3,
          })
          .returning();

        const slots = await tx
          .insert(s.timetableSlots)
          .values(spec.slots.map(([weekday, startsAt, room, kind]) => ({ courseId: course.id, weekday, startsAt, endsAt: PAIRS[startsAt], room, kind })))
          .returning();

        const cps = await tx
          .insert(s.checkpoints)
          .values([4, 8, 11].map((week, n) => ({ courseId: course.id, number: n + 1, week })))
          .returning();

        // Срез 1 проверен на 4-й неделе, срез 2 — в последние дни: это «новые баллы» на главной.
        const [cp1, cp2] = spec.scores;
        await tx.insert(s.checkpointScores).values({
          checkpointId: cps[0].id,
          studentId,
          score: cp1,
          gradedAt: mskInstant(addDays(termStart, 24), "18:00"),
        });
        if (cp2 !== null) {
          await tx.insert(s.checkpointScores).values({
            checkpointId: cps[1].id,
            studentId,
            score: cp2,
            gradedAt: mskInstant(addDays(today, -1 - (i % 5)), `${16 + (i % 3)}:30`),
          });
        }

        await tx.insert(s.courseResults).values({ courseId: course.id, studentId, bonus: spec.bonus ?? 0 });

        // Посещаемость за прошедшие учебные дни.
        let present = 0;
        let absent = 0;
        const rows = [];
        for (const slot of slots) {
          for (let d = nextWeekday(slot.weekday, termStart); d <= yesterday; d = addDays(d, 7)) {
            const r = random();
            const status = r < presentRate ? "present" : r < presentRate + 0.04 ? "excused" : "absent";
            if (status === "present") present++;
            if (status === "absent") absent++;
            rows.push({ slotId: slot.id, date: d, studentId, status } as const);
          }
        }
        if (rows.length) await tx.insert(s.attendance).values(rows);

        seeded.push({ spec, courseId: course.id, slotIds: slots.map((x) => ({ id: x.id, weekday: x.weekday })) });
        forecastInputs.push({
          checkpoints: cp2 === null ? [cp1] : [cp1, cp2],
          bonus: spec.bonus ?? 0,
          session: { kind: spec.assessment, raw: null },
          attendancePct: attendancePercent(present, absent),
          activity: null,
        });
      }
      return { seeded, forecastInputs };
    }

    const ge = await seedGroup(ge2.id, student1.id, GE_COURSES, 0.95, 417);
    const mp = await seedGroup(mp3.id, student2.id, MP_COURSES, 0.8, 1182);

    // Изменения в расписании на ближайшие дни.
    const tomorrow = addDays(today, 1);
    const slotOf = (g: typeof ge, discipline: string, weekday: number) =>
      g.seeded.find((c) => c.spec.discipline === discipline)!.slotIds.find((x) => x.weekday === weekday)!.id;

    const econometricsDate = nextWeekday(2, tomorrow);
    const worldDate = nextWeekday(4, tomorrow);
    const conflictsDate = nextWeekday(3, tomorrow);
    await tx.insert(s.lessonChanges).values([
      {
        slotId: slotOf(ge, "Эконометрика", 2),
        date: econometricsDate,
        kind: "moved",
        newDate: addDays(econometricsDate, 2),
        newStartsAt: "13:00",
        newEndsAt: "14:30",
        newRoom: "ауд. 305",
        reason: "Преподаватель на методическом совещании",
        createdAt: ago(5),
      },
      {
        slotId: slotOf(ge, "Мировая экономика", 4),
        date: worldDate,
        kind: "room",
        newRoom: "ауд. 330, новый корпус",
        reason: "В ауд. 218 меняют проектор",
        createdAt: ago(20),
      },
      {
        slotId: slotOf(mp, "Региональные конфликты", 3),
        date: conflictsDate,
        kind: "cancelled",
        reason: "Преподаватель на конференции. Тема — на самостоятельное изучение, материалы в почте группы",
        createdAt: ago(3),
      },
    ]);

    // Бонус активности

    const kinds = await tx
      .insert(s.achievementKinds)
      .values(ACHIEVEMENT_KINDS.map(({ direction, name, maxPoints }) => ({ direction, name, maxPoints })))
      .returning();
    const kindId = (key: (typeof ACHIEVEMENT_KINDS)[number]["key"]) =>
      kinds[ACHIEVEMENT_KINDS.findIndex((k) => k.key === key)].id;

    await tx.insert(s.achievements).values([
      { studentId: student1.id, termId: term.id, kindId: kindId("conference"), title: "Доклад на студенческой конференции «Экономика завтрашнего дня»", status: "approved", points: 40, createdAt: ago(24 * 20) },
      { studentId: student1.id, termId: term.id, kindId: kindId("journal"), title: "Статья в журнале «Вестник молодых экономистов»", status: "pending", createdAt: ago(30) },
      { studentId: student2.id, termId: term.id, kindId: kindId("help"), title: "Помощь в проведении Дня открытых дверей", status: "approved", points: 30, createdAt: ago(24 * 25) },
    ]);

    // Справки и заявления

    const types = await tx.insert(s.documentTypes).values([...DOCUMENT_TYPES]).returning();
    const typeId = (code: (typeof DOCUMENT_TYPES)[number]["code"]) => types.find((t) => t.code === code)!.id;

    async function request(
      studentId: string,
      code: (typeof DOCUMENT_TYPES)[number]["code"],
      payload: Record<string, string | number>,
      history: { status: "submitted" | "in_review" | "ready" | "issued" | "rejected"; hoursAgo: number; note?: string }[],
    ) {
      const last = history[history.length - 1];
      const [r] = await tx
        .insert(s.requests)
        .values({ studentId, typeId: typeId(code), status: last.status, payload, createdAt: ago(history[0].hoursAgo), updatedAt: ago(last.hoursAgo) })
        .returning();
      await tx.insert(s.requestEvents).values(history.map((h) => ({ requestId: r.id, status: h.status, note: h.note ?? null, createdAt: ago(h.hoursAgo) })));
    }

    await request(student1.id, "study", { purpose: "по месту работы родителей", copies: 1 }, [
      { status: "submitted", hoursAgo: 26 },
      { status: "ready", hoursAgo: 26, note: "Сформирована автоматически" },
    ]);
    await request(student1.id, "recredit", { discipline: "Основы программирования на Python", source: "онлайн-курс, 72 часа" }, [
      { status: "submitted", hoursAgo: 50 },
      { status: "in_review", hoursAgo: 28, note: "Передано на кафедру количественных методов" },
    ]);
    await request(student2.id, "scholarship", { period: "сентябрь — октябрь", copies: 1 }, [
      { status: "submitted", hoursAgo: 4 },
    ]);
    await request(student2.id, "study", { purpose: "в военкомат", copies: 2 }, [
      { status: "submitted", hoursAgo: 24 * 12 },
      { status: "ready", hoursAgo: 24 * 12, note: "Сформирована автоматически" },
      { status: "issued", hoursAgo: 24 * 11, note: "Скачана в PDF" },
    ]);

    // Объявления и уведомления

    const week11 = addDays(termStart, 70);
    await tx.insert(s.announcements).values([
      { title: `Третий срез — ${formatDay(week11)} – ${formatDay(addDays(week11, 4))}`, body: "По всем дисциплинам, на занятиях по расписанию. Если пропускаешь по уважительной причине — договорись с преподавателем о дате заранее.", publishedAt: ago(30) },
      { title: `Запись на курсы по выбору — до ${formatDay(addDays(today, 10))}`, body: "Выбор на следующий триместр: два курса из списка факультета. Записаться можно в разделе «Профиль».", publishedAt: ago(72) },
      { title: "Карьерная неделя: стажировки в банках и консалтинге", body: "Встречи с работодателями каждый день в 16:40, ауд. 101. Регистрация не нужна.", groupId: ge2.id, publishedAt: ago(48) },
      { title: "Модельная ООН: отбор в делегацию", body: "Эссе на английском до конца месяца. Подробности у куратора группы.", groupId: mp3.id, publishedAt: ago(40) },
    ]);

    const notify = (userId: string, kind: "score" | "request" | "change" | "announcement", title: string, body: string, href: string, hoursAgo: number, read = false) => ({
      userId, kind, title, body, href, createdAt: ago(hoursAgo), readAt: read ? ago(hoursAgo - 1) : null,
    });
    await tx.insert(s.notifications).values([
      notify(student1.id, "change", "Перенос: Эконометрика", `${formatDay(econometricsDate)} → ${formatDay(addDays(econometricsDate, 2))}, 13:00, ауд. 305`, "/schedule", 5),
      notify(student1.id, "score", "Новый балл: Макроэкономика", "Срез 2 — 92", "/grades", 24),
      notify(student1.id, "request", "Справка об обучении готова", "Можно скачать PDF с QR-кодом", "/requests", 26, true),
      notify(student1.id, "announcement", "Третий срез через две недели", "Даты в объявлениях", "/", 30, true),
      notify(student2.id, "change", "Отмена: Региональные конфликты", `${formatDay(conflictsDate)}, материалы в почте группы`, "/schedule", 3),
      notify(student2.id, "score", "Новый балл: Английский язык", "Срез 2 — 70", "/grades", 24),
      notify(student2.id, "request", "Заявка принята: справка о стипендии", "Срок — до 2 рабочих дней", "/requests", 4, true),
    ]);

    for (const [who, g, points] of [["student1", ge, 40], ["student2", mp, 30]] as const) {
      const r = ratingForecast(g.forecastInputs, points)!;
      studentRatings.push(`${who}: средний балл ${r.base.toFixed(1)}, рейтинг триместра ${r.rating.toFixed(1)} (прогноз)`);
    }
  });

  console.log(`Готово. Триместр с ${termStart}, сегодня 9-я неделя.`);
  for (const line of studentRatings) console.log(line);
  console.log("Аккаунты: student1, student2, teacher, dean. Пароль — SEED_PASSWORD из .env");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
