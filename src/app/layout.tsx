import type { Metadata, Viewport } from "next";
import { ConceptBanner } from "@/components/concept-banner";
// Golos Text — шрифт с кириллицей под лицензией SIL OFL 1.1, отдаётся с нашего сервера.
import "@fontsource-variable/golos-text";
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
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1117" },
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
