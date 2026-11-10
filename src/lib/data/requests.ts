import "server-only";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { documentTypes, issuedDocuments, notifications, requestEvents, requests } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { isVerificationCode, maskName, newVerificationCode } from "@/lib/documents";
import { SCHEMAS, type DocumentCode } from "@/lib/documents/forms";
import { documentNumber } from "@/lib/documents/pdf";
import type { DocumentSnapshot } from "@/lib/documents/types";
import { getMyRatingSnapshot } from "./learning";
import { getMyProfile } from "./student";

// Справки и заявления студента. Всё, что принимает id, ищет его ТОЛЬКО среди заявок
// студента из сессии: чужая заявка неотличима от несуществующей (страница отдаст 404).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Защита демо от спама: не больше стольких заявок в сутки. */
const DAILY_LIMIT = 20;

export async function getDocumentCatalog() {
  await requireRole("student");
  return db
    .select({
      code: documentTypes.code,
      name: documentTypes.name,
      instant: documentTypes.instant,
      days: documentTypes.days,
      description: documentTypes.description,
    })
    .from(documentTypes)
    .orderBy(desc(documentTypes.instant), asc(documentTypes.name));
}

export async function getMyRequests() {
  const user = await requireRole("student");
  return db
    .select({
      id: requests.id,
      status: requests.status,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      type: documentTypes.name,
      instant: documentTypes.instant,
      days: documentTypes.days,
      number: issuedDocuments.number,
      code: documentTypes.code,
    })
    .from(requests)
    .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
    .leftJoin(issuedDocuments, eq(issuedDocuments.requestId, requests.id))
    .where(eq(requests.studentId, user.id))
    .orderBy(desc(requests.createdAt));
}

/** Заявка студента по id. Чужая или несуществующая — null. */
export async function getMyRequest(requestId: string) {
  const user = await requireRole("student");
  if (!UUID.test(requestId)) return null;

  const [row] = await db
    .select({
      id: requests.id,
      status: requests.status,
      payload: requests.payload,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      type: documentTypes.name,
      code: documentTypes.code,
      instant: documentTypes.instant,
      days: documentTypes.days,
      document: {
        number: issuedDocuments.number,
        code: issuedDocuments.code,
        issuedAt: issuedDocuments.issuedAt,
        revokedAt: issuedDocuments.revokedAt,
      },
    })
    .from(requests)
    .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
    .leftJoin(issuedDocuments, eq(issuedDocuments.requestId, requests.id))
    .where(and(eq(requests.id, requestId), eq(requests.studentId, user.id)))
    .limit(1);
  if (!row) return null;

  const events = await db
    .select({ status: requestEvents.status, note: requestEvents.note, createdAt: requestEvents.createdAt })
    .from(requestEvents)
    .where(eq(requestEvents.requestId, row.id))
    .orderBy(asc(requestEvents.createdAt));

  return {
    ...row,
    document: row.document?.code ? { ...row.document, label: documentNumber(row.code as "study" | "rating", row.document.number!) } : null,
    events,
  };
}

/**
 * Документ для скачивания: снимок и реквизиты. Чужой — null.
 * Первое скачивание переводит заявку из «готово» в «выдано».
 */
export async function takeMyDocument(requestId: string) {
  const user = await requireRole("student");
  if (!UUID.test(requestId)) return null;

  const [row] = await db
    .select({ doc: issuedDocuments, status: requests.status })
    .from(issuedDocuments)
    .innerJoin(requests, eq(requests.id, issuedDocuments.requestId))
    .where(and(eq(issuedDocuments.requestId, requestId), eq(issuedDocuments.studentId, user.id), eq(requests.studentId, user.id)))
    .limit(1);
  if (!row || row.doc.revokedAt) return null;

  if (row.status === "ready") {
    await db.transaction(async (tx) => {
      await tx.update(requests).set({ status: "issued", updatedAt: new Date() }).where(and(eq(requests.id, requestId), eq(requests.studentId, user.id)));
      await tx.insert(requestEvents).values({ requestId, status: "issued", note: "Скачана в PDF" });
    });
  }
  const { snapshot, number, issuedAt, code } = row.doc;
  return { snapshot, number: documentNumber(snapshot.kind, number), issuedAt, code };
}

export type OrderResult = { ok: true; requestId: string } | { ok: false; error: string; fields?: Record<string, string> };

/** Заказ документа. Мгновенные справки выдаются сразу, остальные уходят в деканат. */
export async function orderDocument(code: DocumentCode, input: Record<string, string>): Promise<OrderResult> {
  const user = await requireRole("student");

  const parsed = SCHEMAS[code].safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Проверь поля формы", fields };
  }
  const payload = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== "" && v !== undefined)) as Record<
    string,
    string | number
  >;

  const [type] = await db.select().from(documentTypes).where(eq(documentTypes.code, code)).limit(1);
  if (!type) return { ok: false, error: "Такого документа нет в каталоге" };

  const [{ n }] = await db
    .select({ n: count() })
    .from(requests)
    .where(and(eq(requests.studentId, user.id), gte(requests.createdAt, new Date(Date.now() - 24 * 3_600_000))));
  if (n >= DAILY_LIMIT) return { ok: false, error: "Слишком много заявок за сутки. Попробуй завтра или напиши в деканат." };

  // Снимок собираем до транзакции: это чтение данных студента из сессии.
  let snapshot: DocumentSnapshot | null = null;
  if (type.instant) {
    const p = await getMyProfile();
    const student = {
      lastName: p.lastName,
      firstName: p.firstName,
      middleName: p.middleName,
      recordBookNumber: p.recordBookNumber,
      faculty: p.faculty,
      programCode: p.programCode,
      program: p.program,
      group: p.group,
      course: p.course,
      isPaid: p.isPaid,
    };
    if (code === "study") snapshot = { kind: "study", student, purpose: String(payload.purpose) };
    else if (code === "rating") {
      const rating = await getMyRatingSnapshot();
      if (!rating) return { ok: false, error: "Для выписки пока нет баллов: дождись первых срезов." };
      snapshot = { kind: "rating", student, ...rating };
    }
  }

  const requestId = await db.transaction(async (tx) => {
    const now = new Date();
    const [r] = await tx
      .insert(requests)
      .values({ studentId: user.id, typeId: type.id, status: snapshot ? "ready" : "submitted", payload, createdAt: now, updatedAt: now })
      .returning({ id: requests.id });
    await tx.insert(requestEvents).values({ requestId: r.id, status: "submitted", createdAt: now });
    if (snapshot) {
      await tx.insert(requestEvents).values({ requestId: r.id, status: "ready", note: "Сформирована автоматически", createdAt: now });
      await tx.insert(issuedDocuments).values({ requestId: r.id, studentId: user.id, code: newVerificationCode(), snapshot, issuedAt: now });
    } else {
      await tx.insert(notifications).values({
        userId: user.id,
        kind: "request",
        title: `Заявка принята: ${type.name}`,
        body: type.days ? `Срок — до ${type.days} рабочих дней. Статус будет меняться здесь.` : null,
        href: `/requests/${r.id}`,
        readAt: now,
      });
    }
    return r.id;
  });
  return { ok: true, requestId };
}

/**
 * Публичная проверка подлинности по коду из QR. Без входа, поэтому отдаём минимум:
 * тип, номер, дата, действительна ли, фамилия и инициалы.
 */
export async function verifyDocument(code: string) {
  if (!isVerificationCode(code)) return null;
  const [row] = await db
    .select({
      number: issuedDocuments.number,
      snapshot: issuedDocuments.snapshot,
      issuedAt: issuedDocuments.issuedAt,
      revokedAt: issuedDocuments.revokedAt,
      type: documentTypes.name,
    })
    .from(issuedDocuments)
    .innerJoin(requests, eq(requests.id, issuedDocuments.requestId))
    .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
    .where(eq(issuedDocuments.code, code))
    .limit(1);
  if (!row) return null;
  const s = row.snapshot.student;
  return {
    type: row.type,
    number: documentNumber(row.snapshot.kind, row.number),
    issuedAt: row.issuedAt,
    valid: row.revokedAt === null,
    holder: maskName(s.lastName, s.firstName, s.middleName),
  };
}
