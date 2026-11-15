// Значки для установки на телефон. Рисуются из знака «Деканата 24/7» (циферблат) в установленном Chrome,
// поэтому отдельные библиотеки для картинок не нужны. Запуск: npx tsx scripts/make-icons.ts
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BRAND = "#1d3a8a";
const PAPER = "#fffdf8";

/** Циферблат в квадрате 28×28 с центром (14, 14). scale — доля поля, которую занимает знак. */
function icon(scale: number, radius: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${radius}" fill="${BRAND}"/>
  <g transform="translate(50 50) scale(${(100 * scale) / 28}) translate(-14 -14)" fill="none" stroke="${PAPER}" stroke-linecap="round">
    <circle cx="14" cy="14" r="12.5" stroke-width="2"/>
    <circle cx="14" cy="14" r="8.5" stroke-width="1" stroke-dasharray="1.5 2.5"/>
    <path d="M14 8.5V14l3.5 2.2" stroke-width="2"/>
  </g>
</svg>`;
}

const FILES: { path: string; size: number; scale: number; radius: number }[] = [
  { path: "public/icons/icon-192.png", size: 192, scale: 0.62, radius: 22 },
  { path: "public/icons/icon-512.png", size: 512, scale: 0.62, radius: 22 },
  // Маскируемый значок система обрезает по своей форме: фон во весь квадрат, знак в безопасной середине.
  { path: "public/icons/maskable-512.png", size: 512, scale: 0.5, radius: 0 },
  // iOS сама скругляет углы.
  { path: "src/app/apple-icon.png", size: 180, scale: 0.6, radius: 0 },
];

async function main() {
  mkdirSync("public/icons", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  for (const f of FILES) {
    const page = await browser.newPage({ viewport: { width: f.size, height: f.size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${icon(f.scale, f.radius)}`);
    await page.screenshot({ path: f.path, omitBackground: true });
    await page.close();
    console.log(f.path);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
