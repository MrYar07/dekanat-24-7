// Достижения для бонуса активности: правила подачи и решения деканата.
// Чистые функции без доступа к базе: их вызывают и форма в браузере, и слой данных на сервере.

export const TITLE_MIN = 5;
export const TITLE_MAX = 150;
export const URL_MAX = 300;
export const NOTE_MAX = 300;
/** Предел размера файла-подтверждения. Лимит тела запроса в next.config.ts чуть больше. */
export const FILE_MAX = 3 * 1024 * 1024;
export const FILE_ACCEPT = "application/pdf,image/png,image/jpeg";

export type ProofMime = "application/pdf" | "image/png" | "image/jpeg";

const EXTENSION: Record<ProofMime, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

/**
 * Тип файла по первым байтам. Имени и типу, которые прислал браузер, не верим:
 * под видом «диплом.pdf» можно отправить что угодно.
 */
export function sniffMime(bytes: Uint8Array): ProofMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

/** Имя файла для хранения и скачивания: без пути и служебных символов, с расширением по настоящему типу. */
export function cleanFileName(name: string, mime: ProofMime): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/\.[^.]*$/, "")
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "")
    .trim()
    .slice(0, 80);
  return `${base || "подтверждение"}.${EXTENSION[mime]}`;
}

/** Ссылка-подтверждение: только http(s). Пустая строка — ссылки нет. */
export function normalizeProofUrl(raw: string): { ok: true; url: string | null } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, url: null };
  if (text.length > URL_MAX) return { ok: false, error: `Ссылка не длиннее ${URL_MAX} символов` };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "Это не похоже на ссылку. Она начинается с https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Подойдёт только ссылка на сайт: она начинается с https://" };
  }
  return { ok: true, url: url.href };
}

export type SubmissionInput = {
  kind: string;
  title: string;
  proofUrl: string;
  file: { name: string; bytes: Uint8Array } | null;
};
export type SubmissionField = "kind" | "title" | "proofUrl" | "file";
export type Submission = {
  kind: string;
  title: string;
  proofUrl: string | null;
  file: { name: string; mime: ProofMime; bytes: Uint8Array } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Проверка заявки студента. Ошибки — по полям, тексты на «ты». */
export function checkSubmission(
  input: SubmissionInput,
): { ok: true; value: Submission } | { ok: false; fields: Partial<Record<SubmissionField, string>> } {
  const fields: Partial<Record<SubmissionField, string>> = {};

  if (!UUID.test(input.kind)) fields.kind = "Выбери вид достижения";

  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < TITLE_MIN) fields.title = "Напиши, что это за достижение: хотя бы пару слов";
  else if (title.length > TITLE_MAX) fields.title = `Не длиннее ${TITLE_MAX} символов`;

  const link = normalizeProofUrl(input.proofUrl);
  if (!link.ok) fields.proofUrl = link.error;

  let file: Submission["file"] = null;
  if (input.file) {
    const { bytes, name } = input.file;
    const mime = sniffMime(bytes);
    if (bytes.length > FILE_MAX) fields.file = "Файл больше 3 МБ. Сожми его или приложи ссылку";
    else if (!mime) fields.file = "Подойдёт PDF, JPG или PNG. Этот файл другого типа";
    else file = { name: cleanFileName(name, mime), mime, bytes };
  }

  if (!fields.file && !fields.proofUrl && !file && link.ok && !link.url) {
    fields.file = "Нужно подтверждение: приложи файл или ссылку";
  }

  if (Object.keys(fields).length > 0 || !link.ok) return { ok: false, fields };
  return { ok: true, value: { kind: input.kind, title, proofUrl: link.url, file } };
}

export type DecisionInput = { decision: string; points: string; note: string };
export type Decision = { status: "approved"; points: number; note: string | null } | { status: "rejected"; points: null; note: string };

/** Проверка решения деканата. Тексты без обращения: кабинет сотрудника. */
export function checkDecision(input: DecisionInput, maxPoints: number): { ok: true; value: Decision } | { ok: false; error: string } {
  const note = input.note.trim().slice(0, NOTE_MAX);

  if (input.decision === "rejected") {
    if (!note) return { ok: false, error: "Нужна причина отказа: её увидит студент" };
    return { ok: true, value: { status: "rejected", points: null, note } };
  }
  if (input.decision !== "approved") return { ok: false, error: "Нужно выбрать: засчитать или отклонить" };

  const text = input.points.trim();
  const points = Number(text);
  if (!/^\d+$/.test(text) || points < 1 || points > maxPoints) {
    return { ok: false, error: `Баллы — целое число от 1 до ${maxPoints}: это максимум за такой вид достижения` };
  }
  return { ok: true, value: { status: "approved", points, note: note || null } };
}
