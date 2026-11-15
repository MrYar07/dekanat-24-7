// Значки для установки на телефон. Рисуются из знака «Деканата 24/7» (циферблат) в установленном Chrome,
// поэтому отдельные библиотеки для картинок не нужны. Запуск: npx tsx scripts/make-icons.ts
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BRAND = "#172a5e";
const PAPER = "#f2f5fb";

/** Знак из components/logo.tsx в квадрате 32×32. scale — доля поля, которую занимает знак. */
function icon(scale: number, radius: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${radius}" fill="${BRAND}"/>
  <g transform="translate(50 50) scale(${(100 * scale) / 32}) translate(-16 -16)" fill="none" stroke="${PAPER}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="16" r="14" stroke-width="2"/>
    <circle cx="16" cy="16" r="10.3" stroke-width="1.5" stroke-dasharray="0.1 5.293"/>
    <path d="M11.6 12.4 16 18l6.4-8.2" stroke-width="2.5"/>
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
