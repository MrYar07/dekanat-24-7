import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  index,
  uniqueIndex,
  date,
  jsonb,
  smallint,
  primaryKey,
  serial,
  customType,
} from "drizzle-orm/pg-core";
import type { DocumentSnapshot } from "../lib/documents/types";
import type { GradingSettings } from "../lib/grading";

export const roleEnum = pgEnum("role", ["student", "teacher", "dean_office"]);

// Структура вымышленного университета «Меридиан»

export const faculties = pgTable("faculties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
});

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  facultyId: uuid("faculty_id")
    .notNull()
    .references(() => faculties.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id),
  name: text("name").notNull(),
  course: integer("course").notNull(),
});

// Пользователи и доступ

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentProfiles = pgTable("student_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id),
  recordBookNumber: text("record_book_number").notNull().unique(),
  isPaid: boolean("is_paid").notNull().default(false),
});

export const staffProfiles = pgTable("staff_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  position: text("position").notNull(),
  facultyId: uuid("faculty_id").references(() => faculties.id),
});

// В базе лежит только SHA-256 от токена: утечка таблицы не даёт войти.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_hash_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    login: text("login").notNull(),
    ip: text("ip").notNull(),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_login_idx").on(t.login, t.createdAt), index("login_attempts_ip_idx").on(t.ip, t.createdAt)],
);

// Учебный процесс. Расписание хранится шаблоном недели, конкретные даты считаются от начала триместра.

export const assessmentEnum = pgEnum("assessment", ["exam", "credit"]);
export const lessonKindEnum = pgEnum("lesson_kind", ["lecture", "seminar"]);
export const lessonChangeEnum = pgEnum("lesson_change", ["moved", "cancelled", "room"]);
export const attendanceEnum = pgEnum("attendance_status", ["present", "absent", "excused"]);

export const terms = pgTable("terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Понедельник первой учебной недели. */
  startsOn: date("starts_on").notNull(),
  weeks: smallint("weeks").notNull().default(12),
  isCurrent: boolean("is_current").notNull().default(false),
});

export const disciplines = pgTable("disciplines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

/** Дисциплина, которую группа проходит в триместре у конкретного преподавателя. */
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id),
    assessment: assessmentEnum("assessment").notNull(),
    plannedCheckpoints: smallint("planned_checkpoints").notNull().default(3),
  },
  (t) => [index("courses_group_term_idx").on(t.groupId, t.termId)],
);

/** Пара в недельной сетке: день недели 1–7 (понедельник = 1), время «ЧЧ:ММ» по Москве. */
export const timetableSlots = pgTable(
  "timetable_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    room: text("room").notNull(),
    kind: lessonKindEnum("kind").notNull(),
  },
  (t) => [index("timetable_slots_course_idx").on(t.courseId)],
);

/** Изменение конкретного занятия: перенос, отмена или другая аудитория. */
export const lessonChanges = pgTable(
  "lesson_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => timetableSlots.id, { onDelete: "cascade" }),
    /** Дата занятия по сетке, которое меняется. */
    date: date("date").notNull(),
    kind: lessonChangeEnum("kind").notNull(),
    newDate: date("new_date"),
    newStartsAt: text("new_starts_at"),
    newEndsAt: text("new_ends_at"),
    newRoom: text("new_room"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lesson_changes_slot_idx").on(t.slotId, t.date)],
);

export const checkpoints = pgTable(
  "checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    number: smallint("number").notNull(),
    /** Неделя триместра, на которую запланирован срез. */
    week: smallint("week").notNull(),
  },
  (t) => [uniqueIndex("checkpoints_course_number_idx").on(t.courseId, t.number)],
);

export const checkpointScores = pgTable(
  "checkpoint_scores",
  {
    checkpointId: uuid("checkpoint_id")
      .notNull()
      .references(() => checkpoints.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: smallint("score").notNull(),
    gradedAt: timestamp("graded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.checkpointId, t.studentId] }), index("checkpoint_scores_student_idx").on(t.studentId)],
);

export const attendance = pgTable(
  "attendance",
  {
    slotId: uuid("slot_id")
      .notNull()
      .references(() => timetableSlots.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: attendanceEnum("status").notNull(),
  },
  (t) => [primaryKey({ columns: [t.slotId, t.date, t.studentId] }), index("attendance_student_idx").on(t.studentId)],
);

/** Итоги студента по дисциплине: бонус и активность от преподавателя, сессия. */
export const courseResults = pgTable(
  "course_results",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bonus: smallint("bonus").notNull().default(0),
    activity: smallint("activity"),
    sessionRaw: smallint("session_raw"),
    retakes: smallint("retakes").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.studentId] })],
);

// Бонус активности

export const achievementStatusEnum = pgEnum("achievement_status", ["pending", "approved", "rejected"]);

export const achievementKinds = pgTable("achievement_kinds", {
  id: uuid("id").primaryKey().defaultRandom(),
  direction: text("direction").notNull(),
  name: text("name").notNull(),
  maxPoints: smallint("max_points").notNull(),
});

export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id),
    kindId: uuid("kind_id")
      .notNull()
      .references(() => achievementKinds.id),
    title: text("title").notNull(),
    proofUrl: text("proof_url"),
    status: achievementStatusEnum("status").notNull().default("pending"),
    points: smallint("points"),
    /** Комментарий деканата: при отказе — причина. */
    note: text("note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("achievements_student_idx").on(t.studentId, t.termId)],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * Файл-подтверждение достижения. Лежит отдельно, чтобы списки достижений не тянули из базы мегабайты.
 * mime — определён по содержимому файла на сервере, а не взят у браузера.
 */
export const achievementFiles = pgTable("achievement_files", {
  achievementId: uuid("achievement_id")
    .primaryKey()
    .references(() => achievements.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
});

/** Настройки оценивания (docs/GRADING.md). Одна строка с key = default. */
export const gradingSettings = pgTable("grading_settings", {
  key: text("key").primaryKey(),
  data: jsonb("data").$type<GradingSettings>().notNull(),
});

// Справки и заявления

export const requestStatusEnum = pgEnum("request_status", ["submitted", "in_review", "ready", "issued", "rejected"]);

export const documentTypes = pgTable("document_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  /** true — справка формируется сразу, без участия деканата. */
  instant: boolean("instant").notNull().default(false),
  /** Срок в рабочих днях для неавтоматических. */
  days: smallint("days"),
  description: text("description").notNull(),
});

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    typeId: uuid("type_id")
      .notNull()
      .references(() => documentTypes.id),
    status: requestStatusEnum("status").notNull().default("submitted"),
    payload: jsonb("payload").$type<Record<string, string | number>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("requests_student_idx").on(t.studentId, t.createdAt)],
);

export const requestEvents = pgTable(
  "request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    status: requestStatusEnum("status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("request_events_request_idx").on(t.requestId, t.createdAt)],
);

/**
 * Выданный документ (справка, выписка). code — случайные 128 бит в base64url, по нему публичная
 * проверка подлинности. snapshot — данные на момент выдачи: из них строятся PDF и страница проверки.
 */
export const issuedDocuments = pgTable(
  "issued_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull(),
    requestId: uuid("request_id")
      .notNull()
      .unique()
      .references(() => requests.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    snapshot: jsonb("snapshot").$type<DocumentSnapshot>().notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    /** Отозван деканатом: проверка покажет «недействительна». */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("issued_documents_student_idx").on(t.studentId)],
);

// Объявления и уведомления

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  /** null — для всех; иначе только для группы. */
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationKindEnum = pgEnum("notification_kind", ["score", "request", "change", "announcement"]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);
