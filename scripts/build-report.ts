// PDF «Как создавался проект» для жюри. Собирается из документов репозитория, ничего не пишется руками заново:
// проблема — из PRD, опрос — из docs/research/survey.md, инструменты и этапы — из журнала,
// вход и защита — из ARCHITECTURE.md, «что сделано вручную» — из строк «Вручную» журнала.
//
// Запуск: npm run report → docs/process/kak-sozdavalsya-proekt.pdf
// Нужен установленный Google Chrome (тот же, что для e2e-тестов).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { marked } from "marked";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const out = join(root, "docs/process/kak-sozdavalsya-proekt.pdf");

const SITE = "https://5-35-126-36.sslip.io";
const REPO = "https://github.com/mryar07/dekanat-24-7";

/** Раздел markdown от заголовка до следующего заголовка того же или более высокого уровня. */
function section(md: string, heading: RegExp): string {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) throw new Error(`Нет раздела ${heading}`);
  const level = lines[start].match(/^#+/)![0].length;
  const end = lines.findIndex((l, i) => i > start && /^#+ /.test(l) && l.match(/^#+/)![0].length <= level);
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
}

/** Заголовки внутри раздела опускаются на уровень ниже, чтобы встать под заголовок отчёта. */
const demote = (md: string, by = 1) => md.replace(/^(#+) /gm, (_, h: string) => `${"#".repeat(Math.min(h.length + by, 6))} `);

/** Ссылки на соседние .md в PDF не работают: оставляем текст. Картинки журнала — абсолютными путями. */
function localize(md: string, baseDir: string) {
  return md
    .replace(/!\[([^\]]*)\]\((?!https?:)([^)]+)\)/g, (_, alt: string, src: string) => `![${alt}](${pathToFileURL(join(root, baseDir, src)).href})`)
    .replace(/(?<!!)\[([^\]]+)\]\((?!https?:)[^)]+\.md(#[^)]*)?\)/g, "$1");
}

const prd = read("docs/PRD.md");
const journal = read("docs/process/JOURNAL.md");
const survey = read("docs/research/survey.md");
const arch = read("docs/ARCHITECTURE.md");

// Этапы журнала: всё от первого «## Этап» до конца.
const stagesMd = journal.slice(journal.indexOf("## Этап 1."));
const stageTitles = [...stagesMd.matchAll(/^## (Этап \d+\. .+)$/gm)].map((m) => m[1]);

// «Вручную» по всем этапам: что автор делал сам, без ИИ.
const manual = [...stagesMd.matchAll(/^## (Этап \d+)\..*$([\s\S]*?)(?=^## Этап |$(?![\s\S]))/gm)]
  .map(([, stage, body]) => {
    const m = body.match(/\*\*Вручную:?\*\*:?\s*([\s\S]*?)(?=\n\n\*\*|\n\s*---|\n## |$(?![\s\S]))/);
    // «ничего. Автор установил скиллы» → «Автор установил скиллы»; просто «ничего.» не показываем.
    const text = m?.[1].trim().replace(/^ничего\.\s*/i, "");
    return text ? { stage, text: text[0].toUpperCase() + text.slice(1) } : null;
  })
  .filter((x): x is { stage: string; text: string } => x !== null);

const parts: { id: string; title: string; md: string }[] = [
  { id: "problem", title: "Проблема", md: demote(section(prd, /^## 2\. Проблема/)) },
  { id: "survey", title: "Опрос однокурсников", md: demote(survey.replace(/^# .*\n/, "")) },
  { id: "tools", title: "ИИ-инструменты", md: section(journal, /^## Инструменты/) },
  { id: "stages", title: "Этапы: промпты, решения, ошибки", md: localize(demote(stagesMd.replace(/^---$/gm, "")), "docs/process") },
  { id: "security", title: "Как устроены вход и защита", md: demote(section(arch, /^## Безопасность/)) },
  {
    id: "manual",
    title: "Что сделано вручную",
    md:
      "Всё остальное — код, тексты интерфейса, тесты, документы — сделано ИИ-агентом по промптам автора, автор проверял результат.\n\n" +
      manual.map((m) => `- **${m.stage}.** ${m.text.replace(/\n+/g, " ")}`).join("\n"),
  },
];

const font = (pkg: string, file: string) => pathToFileURL(join(root, "node_modules", pkg, "files", file)).href;
const css = `
@font-face { font-family: "Golos"; src: url("${font("@fontsource-variable/golos-text", "golos-text-cyrillic-wght-normal.woff2")}"); font-weight: 400 900; }
@font-face { font-family: "Golos"; src: url("${font("@fontsource-variable/golos-text", "golos-text-latin-wght-normal.woff2")}"); font-weight: 400 900; unicode-range: U+0000-00FF; }
@font-face { font-family: "PT Serif"; src: url("${font("@fontsource/pt-serif", "pt-serif-cyrillic-400-normal.woff2")}"); font-weight: 400; }
@font-face { font-family: "PT Serif"; src: url("${font("@fontsource/pt-serif", "pt-serif-cyrillic-700-normal.woff2")}"); font-weight: 700; }
@font-face { font-family: "PT Serif"; src: url("${font("@fontsource/pt-serif", "pt-serif-cyrillic-400-italic.woff2")}"); font-style: italic; }
@page { size: A4; margin: 18mm 18mm 20mm; }
* { box-sizing: border-box; }
body { font-family: "Golos", sans-serif; font-size: 10pt; line-height: 1.5; color: #181c1f; }
h1, h2, h3, h4 { font-family: "PT Serif", serif; line-height: 1.2; break-after: avoid; }
h1 { font-size: 22pt; margin: 0 0 6mm; color: #172a5e; }
h2 { font-size: 15pt; margin: 9mm 0 3mm; padding-top: 2mm; border-top: 0.5pt solid #c5cfc8; }
h3 { font-size: 12pt; margin: 6mm 0 2mm; }
h4 { font-size: 10.5pt; margin: 4mm 0 1.5mm; }
p, li { orphans: 3; widows: 3; }
a { color: #1d3a8a; }
code { font-size: 9pt; background: #e1e8e3; padding: 0 1mm; border-radius: 1mm; }
blockquote { margin: 3mm 0; padding: 1mm 4mm; border-left: 2pt solid #5a3ea6; color: #3f4a44; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 9pt; break-inside: avoid; }
th, td { border: 0.5pt solid #c5cfc8; padding: 1.2mm 2mm; text-align: left; vertical-align: top; }
th { background: #e1e8e3; }
img { max-width: 100%; max-height: 120mm; width: auto; border: 0.5pt solid #c5cfc8; border-radius: 1.5mm; margin: 2mm 3mm 2mm 0; vertical-align: top; break-inside: avoid; }
p:has(img) { break-inside: avoid; }
.part { break-before: page; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: space-between; }
.cover .band { background: #172a5e; color: #f2f5fb; padding: 14mm 12mm; border-radius: 3mm; }
.cover .band h1 { color: #f2f5fb; font-size: 30pt; margin: 0 0 3mm; }
.cover .band p { margin: 0; font-family: "PT Serif", serif; font-style: italic; color: #b3bfdc; font-size: 12pt; }
.concept { border: 1pt solid #7d4f00; background: #f3e7cd; color: #7d4f00; padding: 3mm 4mm; border-radius: 2mm; font-size: 9.5pt; }
.meta td:first-child { width: 38mm; color: #56605b; }
.toc ol { padding-left: 5mm; } .toc li { margin: 1mm 0; }
.toc .stages { columns: 2; font-size: 8.5pt; color: #56605b; margin-top: 1mm; }
`;

const today = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date());

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Деканат 24/7 — как создавался проект</title><style>${css}</style></head><body>
<section class="cover">
  <div>
    <div class="band"><h1>Деканат 24/7</h1><p>Как создавался проект: от разбора задания до работающего кабинета</p></div>
    <table class="meta" style="margin-top:8mm">
      <tr><td>Конкурс</td><td>MGIMO AI Challenge 2026, номинация «Вайб-кодинг»</td></tr>
      <tr><td>Прототип</td><td><a href="${SITE}">${SITE}</a></td></tr>
      <tr><td>Код</td><td><a href="${REPO}">${REPO}</a></td></tr>
      <tr><td>Главный инструмент</td><td>Claude Code, модель Claude Opus 5.5</td></tr>
      <tr><td>Этапов в журнале</td><td>${stageTitles.length}</td></tr>
      <tr><td>Собрано</td><td>${today} из docs/process/JOURNAL.md скриптом scripts/build-report.ts</td></tr>
    </table>
  </div>
  <p class="concept">Концепт для конкурса MGIMO AI Challenge. Не официальный сервис. Университет «Меридиан» и все данные в прототипе вымышлены.</p>
</section>
<section class="part toc"><h1>Содержание</h1><ol>
${parts.map((p) => `<li><a href="#${p.id}">${p.title}</a>${p.id === "stages" ? `<div class="stages">${stageTitles.map((t) => `<div>${t}</div>`).join("")}</div>` : ""}</li>`).join("\n")}
</ol></section>
${parts.map((p) => `<section class="part" id="${p.id}"><h1>${p.title}</h1>${marked.parse(p.md, { async: false })}</section>`).join("\n")}
</body></html>`;

// tsx собирает скрипты в CommonJS, где нет await верхнего уровня.
async function main() {
const dir = mkdtempSync(join(tmpdir(), "report-"));
try {
  const file = join(dir, "report.html");
  writeFileSync(file, html);
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: out,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:8px;color:#56605b;padding:0 18mm;display:flex;justify-content:space-between;font-family:sans-serif">
      <span>Деканат 24/7 · как создавался проект · концепт, данные вымышлены</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "18mm", bottom: "20mm", left: "18mm", right: "18mm" },
  });
  await browser.close();
  console.log(`Готово: ${out} (этапов: ${stageTitles.length}, пунктов «вручную»: ${manual.length})`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
