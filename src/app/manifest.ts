import type { MetadataRoute } from "next";
import { THEME_COLOR } from "@/lib/theme";

// Кабинет можно поставить на главный экран телефона: он открывается без адресной строки, как приложение.
// Значки нарисованы скриптом scripts/make-icons.ts из знака «Деканата 24/7».
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Деканат 24/7 — концепт кабинета студента",
    short_name: "Деканат 24/7",
    description: "Концепт личного кабинета студента вымышленного университета «Меридиан». Не официальный сервис.",
    lang: "ru",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
