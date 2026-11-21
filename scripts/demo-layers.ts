// Слои с текстом для монтажа демо-видео (scripts/compose-demo.py): заголовки, подписи, плашки, QR-код.
// Вёрстка — в Chrome, шрифтами самого сайта (PT Serif и Golos Text), фон прозрачный.
// Каждое слово подписи — отдельный <span class="w">: монтаж получает его рамку и проявляет слова по очереди.
//
// Запуск (из compose-demo.py): npx tsx scripts/demo-layers.ts <spec.json> <папка>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import QRCode from "qrcode";

type Layer = { id: string; html: string; width?: number; css?: string; qr?: string };

const [specPath, outDir] = process.argv.slice(2);
const spec: { css: string; layers: Layer[] } = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

// Шрифты — прямо в странице (data: URL): страница из setContent не может читать файлы с диска.
const font = (pkg: string, file: string) =>
  `data:font/woff2;base64,${readFileSync(resolve("node_modules", pkg, "files", file)).toString("base64")}`;
const FONTS = `
@font-face { font-family: "Golos"; font-weight: 400 900; src: url(${font("@fontsource-variable/golos-text", "golos-text-cyrillic-wght-normal.woff2")}) format("woff2"); unicode-range: U+0400-04FF; }
@font-face { font-family: "Golos"; font-weight: 400 900; src: url(${font("@fontsource-variable/golos-text", "golos-text-latin-wght-normal.woff2")}) format("woff2"); unicode-range: U+0000-03FF, U+2000-206F, U+20AC, U+2116; }
@font-face { font-family: "PT Serif"; font-weight: 700; src: url(${font("@fontsource/pt-serif", "pt-serif-cyrillic-700-normal.woff2")}) format("woff2"); unicode-range: U+0400-04FF; }
@font-face { font-family: "PT Serif"; font-weight: 700; src: url(${font("@fontsource/pt-serif", "pt-serif-latin-700-normal.woff2")}) format("woff2"); unicode-range: U+0000-03FF, U+2000-206F, U+2116; }
@font-face { font-family: "PT Serif"; font-weight: 400; font-style: italic; src: url(${font("@fontsource/pt-serif", "pt-serif-cyrillic-400-italic.woff2")}) format("woff2"); unicode-range: U+0400-04FF; }
@font-face { font-family: "PT Serif"; font-weight: 400; font-style: italic; src: url(${font("@fontsource/pt-serif", "pt-serif-latin-400-italic.woff2")}) format("woff2"); unicode-range: U+0000-03FF, U+2000-206F; }
`;

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS}
    html, body { margin: 0; background: transparent; }
    #stage { position: absolute; left: 0; top: 0; display: inline-block; padding: 12px; }
    ${spec.css}
  </style></head><body><div id="stage"></div></body></html>`);
  // Проверка, что шрифты на месте: иначе Chrome молча подставит Times New Roman.
  const missing = await page.evaluate(async () => {
    const need = ["700 40px 'PT Serif'", "italic 400 40px 'PT Serif'", "400 40px Golos", "700 40px Golos"];
    const bad = [];
    for (const f of need) if (!(await document.fonts.load(f, "Яя")).length) bad.push(f);
    return bad;
  });
  if (missing.length) throw new Error(`Шрифты не загрузились: ${missing.join(", ")}`);
  const meta: Record<string, { w: number; h: number; pad: number; words: { x: number; y: number; w: number; h: number }[] }> = {};

  for (const layer of spec.layers) {
    let html = layer.html;
    if (layer.qr) {
      const url = await QRCode.toDataURL(layer.qr, { margin: 0, width: 600, color: { dark: "#172a5eff", light: "#00000000" } });
      html = html.replace("{{qr}}", url);
    }
    const info = await page.evaluate(
      async ({ html, width, css }) => {
        const stage = document.getElementById("stage")!;
        stage.innerHTML = html;
        stage.style.width = width ? `${width}px` : "";
        stage.setAttribute("style", `${stage.getAttribute("style") ?? ""};${css ?? ""}`);
        await document.fonts.ready;
        await Promise.all([...stage.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
        const s = stage.getBoundingClientRect();
        const words = [...stage.querySelectorAll(".w")].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x - s.x, y: r.y - s.y, w: r.width, h: r.height };
        });
        return { w: Math.ceil(s.width), h: Math.ceil(s.height), words };
      },
      { html, width: layer.width, css: layer.css },
    );
    await page.locator("#stage").screenshot({ path: join(outDir, `${layer.id}.png`), omitBackground: true });
    meta[layer.id] = { ...info, pad: 12 };
    await page.evaluate(() => document.getElementById("stage")!.removeAttribute("style"));
  }
  writeFileSync(join(outDir, "layers.json"), JSON.stringify(meta, null, 1));
  await browser.close();
  console.log(`слоёв: ${spec.layers.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
