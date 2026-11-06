import type { Metadata, Viewport } from "next";
import { ConceptBanner } from "@/components/concept-banner";
// Golos Text (текст) и PT Serif (заголовки, цифры) — шрифты с кириллицей под SIL OFL 1.1, отдаются с нашего сервера.
import "@fontsource-variable/golos-text";
import "@fontsource/pt-serif/400.css";
import "@fontsource/pt-serif/400-italic.css";
import "@fontsource/pt-serif/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Деканат 24/7", template: "%s · Деканат 24/7" },
  description: "Концепт личного кабинета студента вымышленного университета «Меридиан». Не официальный сервис.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ea" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="min-h-dvh antialiased">
        <ConceptBanner />
        {children}
      </body>
    </html>
  );
}
