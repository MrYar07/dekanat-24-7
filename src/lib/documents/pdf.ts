import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { DocumentSnapshot, RatingRow, RatingSnapshot, StudentSnapshot, StudySnapshot, TermRecord } from "./types";

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

// Нижняя граница текста на странице. На последней странице ниже — блок с QR-кодом.
const BOTTOM = M + 18;
const QR = 104;
const FOOTER_TOP = M + QR + 16;

class Writer {
  y = H - M;
  page: PDFPage;
  /** Низ области текста. Блок с QR-кодом рисуется ниже, поэтому там граница снимается. */
  bottom = BOTTOM;

  constructor(
    readonly doc: PDFDocument,
    readonly f: Fonts,
    private readonly continuation: (w: Writer) => void,
  ) {
    this.page = doc.addPage([W, H]);
  }

  /** Новая страница с шапкой продолжения. */
  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.continuation(this);
  }

  /** Если блок высотой h не помещается — переносим на следующую страницу. */
  ensure(h: number) {
    if (this.y - h < this.bottom) this.newPage();
  }

  text(s: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; gap?: number; width?: number } = {}) {
    const size = opts.size ?? 11;
    const face = opts.bold ? this.f.bold : this.f.regular;
    const x = opts.x ?? M;
    const lineHeight = size * 1.45;
    for (const line of wrap(s, opts.width ?? W - x - M, (t) => widthOf(t, size, face))) {
      this.ensure(lineHeight);
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

  /** Строка «название ……… значение», как ведомость в интерфейсе. Не разрывается между страницами. */
  row(label: string, value: string, size = 11) {
    const labelW = 170;
    const lh = size * 1.45;
    const lines = Math.max(
      wrap(label, labelW - 8, (t) => widthOf(t, size, this.f.regular)).length,
      wrap(value, W - M - labelW - M, (t) => widthOf(t, size, this.f.regular)).length,
    );
    this.ensure(lines * lh + 4);
    const startY = this.y;
    this.text(label, { size, color: MUTED, width: labelW - 8 });
    const afterLabel = this.y;
    this.y = startY;
    this.text(value, { size, x: M + labelW });
    this.y = Math.min(this.y, afterLabel) - 4;
  }
}

/** Обязательная пометка конкурса — на каждой странице. */
function conceptBanner(page: PDFPage, f: Fonts) {
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
}

function header(w: Writer, title: string, info: IssueInfo) {
  const { page, f } = w;
  conceptBanner(page, f);
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

/** Шапка следующих страниц: пометка, номер документа и владелец — чтобы лист не потерялся. */
function continuationHeader(title: string, info: IssueInfo, holder: string) {
  return (w: Writer) => {
    conceptBanner(w.page, w.f);
    w.y = H - 26 - 12;
    w.text(`${title} № ${info.number} · ${holder}`, { size: 9, color: MUTED });
    w.rule(8);
  };
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

const COLS = [M, M + 250, M + 320, M + 370];
const ROW_SIZE = 10.5;

function rowLines(w: Writer, r: RatingRow) {
  return wrap(r.discipline, 240, (t) => widthOf(t, ROW_SIZE, w.f.regular));
}

/** Высота таблицы с шапкой и сноской о пересдаче. */
function tableHeight(w: Writer, rows: RatingRow[]) {
  return 20 + rows.reduce((h, r) => h + 16 + (rowLines(w, r).length - 1) * 14 + 6, 0) + (rows.some((r) => r.retakes) ? 18 : 0);
}

/** Если раздел помещается на страницу целиком, он не разрывается. Длинный переносится по строкам таблицы. */
function keepTogether(w: Writer, h: number) {
  if (h <= H - 26 - 40 - BOTTOM) w.ensure(h);
}

/** Таблица дисциплин. При переносе на новую страницу шапка таблицы повторяется. */
function disciplineTable(w: Writer, rows: RatingRow[]) {
  const headRow = () => {
    w.y -= 14;
    ["Дисциплина", "Форма", "Балл", "Оценка"].forEach((h, i) => draw(w.page, h, COLS[i], w.y, 9, w.f.bold, MUTED));
    w.y -= 6;
    w.page.drawLine({ start: { x: M, y: w.y }, end: { x: W - M, y: w.y }, thickness: 0.6, color: RULE });
  };
  const layout = rows.map((r) => {
    const lines = rowLines(w, r);
    return { r, lines, h: 16 + (lines.length - 1) * 14 + 6 };
  });
  // Шапка не остаётся одна внизу страницы: с ней переносится хотя бы первая строка.
  w.ensure(20 + (layout[0]?.h ?? 0));
  headRow();
  for (const { r, lines, h } of layout) {
    if (w.y - h < w.bottom) {
      w.newPage();
      headRow();
    }
    w.y -= 16;
    const rowTop = w.y;
    lines.forEach((l, i) => draw(w.page, l, COLS[0], rowTop - i * 14, ROW_SIZE, w.f.regular));
    draw(w.page, r.assessment === "exam" ? "экзамен" : "зачёт", COLS[1], rowTop, ROW_SIZE, w.f.regular, MUTED);
    draw(w.page, `${one.format(r.score)}${r.retakes ? "*" : ""}`, COLS[2], rowTop, ROW_SIZE, w.f.bold);
    draw(w.page, r.mark, COLS[3], rowTop, ROW_SIZE, w.f.regular);
    w.y = rowTop - (lines.length - 1) * 14 - 6;
    w.page.drawLine({ start: { x: M, y: w.y }, end: { x: W - M, y: w.y }, thickness: 0.4, color: RULE });
  }
  if (rows.some((r) => r.retakes)) {
    w.y -= 4;
    w.text("* сдано с пересдачи", { size: 9, color: MUTED });
  }
}

/** Закрытый триместр в выписке «за всё время». */
function termSection(w: Writer, t: TermRecord) {
  w.y -= 10;
  // Заголовок, таблица и рейтинг триместра — на одной странице, если помещаются.
  keepTogether(w, 12 * 1.45 + tableHeight(w, t.rows) + 8 + 10.5 * 1.45 + 4);
  w.text(t.term, { size: 12, bold: true });
  disciplineTable(w, t.rows);
  w.y -= 8;
  w.row("Рейтинг триместра", `${one.format(t.rating)} (средний балл ${one.format(t.base)}, бонус +${one.format(t.bonus)})`, 10.5);
}

function ratingBody(w: Writer, s: RatingSnapshot) {
  const all = s.history !== undefined;
  w.text(`${fullName(s.student)}, группа ${s.student.group}, ${s.student.course} курс.${all ? "" : ` ${s.term}.`}`, {
    size: 12,
    gap: all ? 4 : 14,
  });

  if (all) {
    const n = s.history!.length + 1;
    w.text(`За всё время обучения: ${n} ${plural(n, "триместр", "триместра", "триместров")}, последний — текущий.`, {
      size: 10.5,
      color: MUTED,
      gap: 4,
    });
    for (const t of s.history!) termSection(w, t);
    w.y -= 10;
    keepTogether(w, 12 * 1.45 + tableHeight(w, s.rows));
    w.text(`${s.term} — текущий`, { size: 12, bold: true });
  }

  disciplineTable(w, s.rows);
  w.y -= 12;
  w.row("Средний балл", one.format(s.base));
  w.row("Бонус активности", `+${one.format(s.bonus)}`);
  w.row("Рейтинг триместра", one.format(s.rating));
  if (s.place) w.row(`Место на ${s.place.course}-м курсе`, `${s.place.place} из ${s.place.total}`);
  for (const y of s.years ?? []) {
    w.row(`Годовой рейтинг ${y.academicYear}${y.complete ? "" : ", прогноз"}`, one.format(y.rating));
  }
  if (s.forecast) {
    w.y -= 6;
    w.text(
      "Сессия ещё не прошла: вместо её результатов учтён балл за работу в триместре, рейтинг указан как прогноз.",
      { size: 9.5, color: MUTED },
    );
  }
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

async function footer(doc: PDFDocument, w: Writer, info: IssueInfo) {
  // Блок с QR-кодом — целиком на последней странице.
  if (w.y < FOOTER_TOP + 12) w.newPage();
  w.bottom = 0;
  const png = await QRCode.toBuffer(info.verifyUrl, { type: "png", margin: 1, width: 360, errorCorrectionLevel: "M" });
  const qr = await doc.embedPng(png);
  const bottom = M;
  w.page.drawImage(qr, { x: M, y: bottom, width: QR, height: QR });
  w.page.drawLine({ start: { x: M, y: FOOTER_TOP }, end: { x: W - M, y: FOOTER_TOP }, thickness: 0.6, color: RULE });

  const x = M + QR + 18;
  w.y = bottom + QR + 2;
  const width = W - x - M;
  w.text("Подлинность можно проверить по QR-коду или по ссылке:", { size: 10, bold: true, x, width });
  w.text(info.verifyUrl, { size: 9, x, width, color: BRAND, gap: 4 });
  w.text(`Код проверки: ${info.code}`, { size: 9, x, width, color: MUTED, gap: 6 });
  w.text(
    "Документ сформирован автоматически в системе «Деканат 24/7» и действителен без подписи и печати.",
    { size: 9, x, width, color: MUTED },
  );
}

/** «Стр. 1 из 3» внизу каждой страницы — только если страниц больше одной. */
function pageNumbers(doc: PDFDocument, f: Fonts) {
  const pages = doc.getPages();
  if (pages.length < 2) return;
  pages.forEach((page, i) => {
    const s = `Стр. ${i + 1} из ${pages.length}`;
    draw(page, s, W - M - widthOf(s, 8.5, f.regular), M / 2 - 4, 8.5, f.regular, MUTED);
  });
}

export const DOCUMENT_TITLE: Record<DocumentSnapshot["kind"], string> = {
  study: "СПРАВКА ОБ ОБУЧЕНИИ",
  rating: "ВЫПИСКА РЕЙТИНГА",
};

/** Заголовок документа: у выписки «за всё время» он длиннее. */
export function documentTitle(s: DocumentSnapshot) {
  return s.kind === "rating" && s.history ? "ВЫПИСКА РЕЙТИНГА ЗА ВСЁ ВРЕМЯ ОБУЧЕНИЯ" : DOCUMENT_TITLE[s.kind];
}

export async function renderDocument(snapshot: DocumentSnapshot, info: IssueInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const title = documentTitle(snapshot);
  doc.setTitle(`${title} № ${info.number}`);
  doc.setAuthor("Университет «Меридиан» (вымышленный), Деканат 24/7");
  doc.setCreator("Деканат 24/7");
  doc.setLanguage("ru-RU");
  const fonts = await loadFonts(doc);
  const s = snapshot.student;
  const holder = `${s.lastName} ${s.firstName[0]}.${s.middleName ? ` ${s.middleName[0]}.` : ""}`;
  const w = new Writer(doc, fonts, continuationHeader(DOCUMENT_TITLE[snapshot.kind], info, holder));

  header(w, title, info);
  if (snapshot.kind === "study") studyBody(w, snapshot);
  else ratingBody(w, snapshot);
  await footer(doc, w, info);
  pageNumbers(doc, fonts);

  return doc.save();
}

/** «С-000012» для справок, «Р-000013» для выписок. */
export function documentNumber(kind: DocumentSnapshot["kind"], serial: number) {
  return `${kind === "study" ? "С" : "Р"}-${String(serial).padStart(6, "0")}`;
}
