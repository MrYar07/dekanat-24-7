import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { DocumentSnapshot, RatingSnapshot, StudentSnapshot, StudySnapshot } from "./types";

// PDF справок «Деканата 24/7». PT Serif (OFL) разбит на наборы: кириллица отдельно от латиницы
// и цифр. Поэтому текст рисуется кусками, и для каждого символа берётся набор, в котором он есть.

type Face = { cyr: PDFFont; lat: PDFFont };
type Fonts = { regular: Face; bold: Face };

export type IssueInfo = {
  /** Номер документа для людей: «С-000012». */
  number: string;
  issuedAt: Date;
  code: string;
  verifyUrl: string;
};

const FONT_DIR = join(process.cwd(), "assets", "fonts");
const INK = rgb(0.09, 0.08, 0.06);
const MUTED = rgb(0.42, 0.4, 0.36);
const BRAND = rgb(0.11, 0.23, 0.54);
const RULE = rgb(0.85, 0.82, 0.76);

const isCyrillic = (cp: number) => (cp >= 0x0400 && cp <= 0x052f) || cp === 0x2116; // №

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const load = async (name: string) =>
    doc.embedFont(await readFile(join(FONT_DIR, `pt-serif-${name}-normal.woff`)), { subset: true });
  const [cyr4, cyr7, lat4, lat7] = await Promise.all([
    load("cyrillic-400"),
    load("cyrillic-700"),
    load("latin-400"),
    load("latin-700"),
  ]);
  return { regular: { cyr: cyr4, lat: lat4 }, bold: { cyr: cyr7, lat: lat7 } };
}

/** Разбивает строку на куски одного набора шрифта. */
export function runs(text: string): { cyr: boolean; text: string }[] {
  const out: { cyr: boolean; text: string }[] = [];
  for (const ch of text) {
    const cyr = isCyrillic(ch.codePointAt(0)!);
    const last = out[out.length - 1];
    if (last && last.cyr === cyr) last.text += ch;
    else out.push({ cyr, text: ch });
  }
  return out;
}

function widthOf(text: string, size: number, face: Face) {
  return runs(text).reduce((w, r) => w + (r.cyr ? face.cyr : face.lat).widthOfTextAtSize(r.text, size), 0);
}

function draw(page: PDFPage, text: string, x: number, y: number, size: number, face: Face, color = INK) {
  for (const r of runs(text)) {
    const font = r.cyr ? face.cyr : face.lat;
    page.drawText(r.text, { x, y, size, font, color });
    x += font.widthOfTextAtSize(r.text, size);
  }
}

/** Перенос по словам в пределах ширины. */
export function wrap(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const fullName = (s: StudentSnapshot) => [s.lastName, s.firstName, s.middleName].filter(Boolean).join(" ");
const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });
const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// A4 в пунктах.
const W = 595.28;
const H = 841.89;
const M = 56;

class Writer {
  y = H - M;
  constructor(
    readonly page: PDFPage,
    readonly f: Fonts,
  ) {}

  text(s: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; gap?: number; width?: number } = {}) {
    const size = opts.size ?? 11;
    const face = opts.bold ? this.f.bold : this.f.regular;
    const x = opts.x ?? M;
    const lineHeight = size * 1.45;
    for (const line of wrap(s, opts.width ?? W - x - M, (t) => widthOf(t, size, face))) {
      this.y -= lineHeight;
      draw(this.page, line, x, this.y, size, face, opts.color);
    }
    this.y -= opts.gap ?? 0;
  }

  right(s: string, size: number, bold = false, color = INK) {
    const face = bold ? this.f.bold : this.f.regular;
    this.y -= size * 1.45;
    draw(this.page, s, W - M - widthOf(s, size, face), this.y, size, face, color);
  }

  rule(gap = 12) {
    this.y -= gap;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.6, color: RULE });
    this.y -= gap;
  }

  /** Строка «название ……… значение», как ведомость в интерфейсе. */
  row(label: string, value: string, size = 11) {
    const labelW = 170;
    const startY = this.y;
    this.text(label, { size, color: MUTED, width: labelW - 8 });
    const afterLabel = this.y;
    this.y = startY;
    this.text(value, { size, x: M + labelW });
    this.y = Math.min(this.y, afterLabel) - 4;
  }
}

function header(w: Writer, title: string, info: IssueInfo) {
  const { page, f } = w;
  // Обязательная пометка конкурса: документ вымышленный.
  page.drawRectangle({ x: 0, y: H - 26, width: W, height: 26, color: rgb(0.97, 0.95, 0.9) });
  draw(
    page,
    "КОНЦЕПТ · Вымышленный университет, прототип для конкурса MGIMO AI Challenge. Не является официальным документом.",
    M,
    H - 17,
    7.5,
    f.regular,
    MUTED,
  );
  w.y = H - 26 - 28;
  const top = w.y;
  w.text("Университет «Меридиан»", { size: 16, bold: true, color: BRAND });
  w.text("Деканат 24/7 · электронный документ", { size: 9, color: MUTED });
  w.y = top;
  w.right(`№ ${info.number}`, 11, true);
  w.right(`от ${dateFormat.format(info.issuedAt)}`, 10, false, MUTED);
  w.rule(18);
  w.y -= 8;
  const size = 17;
  w.y -= size * 1.45;
  draw(page, title, (W - widthOf(title, size, f.bold)) / 2, w.y, size, f.bold);
  w.y -= 18;
}

function studentRows(w: Writer, s: StudentSnapshot) {
  w.row("Факультет", s.faculty);
  w.row("Направление", `${s.programCode} «${s.program}»`);
  w.row("Курс, группа", `${s.course} курс, группа ${s.group}`);
  w.row("Форма обучения", "очная");
  w.row("Основа обучения", s.isPaid ? "по договору об оказании платных образовательных услуг" : "за счёт бюджетных ассигнований");
  w.row("Зачётная книжка", `№ ${s.recordBookNumber}`);
}

function studyBody(w: Writer, s: StudySnapshot) {
  w.text(`Настоящим подтверждается, что ${fullName(s.student)} действительно обучается в университете «Меридиан».`, {
    size: 12,
    gap: 14,
  });
  studentRows(w, s.student);
  w.y -= 14;
  w.text(`Справка выдана для предъявления: ${s.purpose}.`, { size: 12 });
}

function ratingBody(w: Writer, s: RatingSnapshot) {
  w.text(`${fullName(s.student)}, группа ${s.student.group}, ${s.student.course} курс. ${s.term}.`, { size: 12, gap: 14 });

  const cols = [M, M + 250, M + 320, M + 370];
  const head = ["Дисциплина", "Форма", "Балл", "Оценка"];
  w.y -= 14;
  head.forEach((h, i) => draw(w.page, h, cols[i], w.y, 9, w.f.bold, MUTED));
  w.y -= 6;
  w.page.drawLine({ start: { x: M, y: w.y }, end: { x: W - M, y: w.y }, thickness: 0.6, color: RULE });
  for (const r of s.rows) {
    const lines = wrap(r.discipline, 240, (t) => widthOf(t, 10.5, w.f.regular));
    w.y -= 16;
    const rowTop = w.y;
    lines.forEach((l, i) => draw(w.page, l, cols[0], rowTop - i * 14, 10.5, w.f.regular));
    draw(w.page, r.assessment === "exam" ? "экзамен" : "зачёт", cols[1], rowTop, 10.5, w.f.regular, MUTED);
    draw(w.page, one.format(r.score), cols[2], rowTop, 10.5, w.f.bold);
    draw(w.page, r.mark, cols[3], rowTop, 10.5, w.f.regular);
    w.y = rowTop - (lines.length - 1) * 14 - 6;
    w.page.drawLine({ start: { x: M, y: w.y }, end: { x: W - M, y: w.y }, thickness: 0.4, color: RULE });
  }
  w.y -= 12;
  w.row("Средний балл", one.format(s.base));
  w.row("Бонус активности", `+${one.format(s.bonus)}`);
  w.row("Рейтинг триместра", one.format(s.rating));
  if (s.forecast) {
    w.y -= 6;
    w.text(
      "Сессия ещё не прошла: вместо её результатов учтён балл за работу в триместре, рейтинг указан как прогноз.",
      { size: 9.5, color: MUTED },
    );
  }
}

async function footer(doc: PDFDocument, w: Writer, info: IssueInfo) {
  const png = await QRCode.toBuffer(info.verifyUrl, { type: "png", margin: 1, width: 360, errorCorrectionLevel: "M" });
  const qr = await doc.embedPng(png);
  const size = 104;
  const bottom = M;
  w.page.drawImage(qr, { x: M, y: bottom, width: size, height: size });
  w.page.drawLine({ start: { x: M, y: bottom + size + 16 }, end: { x: W - M, y: bottom + size + 16 }, thickness: 0.6, color: RULE });

  const x = M + size + 18;
  w.y = bottom + size + 2;
  const width = W - x - M;
  w.text("Подлинность можно проверить по QR-коду или по ссылке:", { size: 10, bold: true, x, width });
  w.text(info.verifyUrl, { size: 9, x, width, color: BRAND, gap: 4 });
  w.text(`Код проверки: ${info.code}`, { size: 9, x, width, color: MUTED, gap: 6 });
  w.text(
    "Документ сформирован автоматически в системе «Деканат 24/7» и действителен без подписи и печати.",
    { size: 9, x, width, color: MUTED },
  );
}

export const DOCUMENT_TITLE: Record<DocumentSnapshot["kind"], string> = {
  study: "СПРАВКА ОБ ОБУЧЕНИИ",
  rating: "ВЫПИСКА РЕЙТИНГА",
};

export async function renderDocument(snapshot: DocumentSnapshot, info: IssueInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${DOCUMENT_TITLE[snapshot.kind]} № ${info.number}`);
  doc.setAuthor("Университет «Меридиан» (вымышленный), Деканат 24/7");
  doc.setCreator("Деканат 24/7");
  doc.setLanguage("ru-RU");
  const fonts = await loadFonts(doc);
  const w = new Writer(doc.addPage([W, H]), fonts);

  header(w, DOCUMENT_TITLE[snapshot.kind], info);
  if (snapshot.kind === "study") studyBody(w, snapshot);
  else ratingBody(w, snapshot);
  await footer(doc, w, info);

  return doc.save();
}

/** «С-000012» для справок, «Р-000013» для выписок. */
export function documentNumber(kind: DocumentSnapshot["kind"], serial: number) {
  return `${kind === "study" ? "С" : "Р"}-${String(serial).padStart(6, "0")}`;
}
