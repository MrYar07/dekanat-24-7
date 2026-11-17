import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { A11yBar } from "@/components/a11y";
import { ConceptBanner } from "@/components/concept-banner";
import { DemoGuide } from "@/components/demo-guide";
import { getCurrentUser } from "@/lib/auth/dal";
import { demoEnabled, isDemoLogin } from "@/lib/demo/accounts";
// Golos Text (текст) и PT Serif (заголовки, цифры) — шрифты с кириллицей под SIL OFL 1.1, отдаются с нашего сервера.
import "@fontsource-variable/golos-text";
import "@fontsource/pt-serif/400.css";
import "@fontsource/pt-serif/400-italic.css";
import "@fontsource/pt-serif/700.css";
import { A11Y_COOKIE, a11yAttributes, CONTRAST_COLOR, parseA11y } from "@/lib/a11y";
import { isTheme, THEME_COLOR, THEME_COOKIE, type Theme } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Деканат 24/7", template: "%s · Деканат 24/7" },
  description: "Концепт личного кабинета студента вымышленного университета «Меридиан». Не официальный сервис.",
  robots: { index: false, follow: false },
};

/** Тема, которую человек выбрал сам. null — как в системе. */
async function chosenTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : null;
}

/** Версия для слабовидящих: null — обычная. */
async function chosenA11y() {
  return parseA11y((await cookies()).get(A11Y_COOKIE)?.value);
}

export async function generateViewport(): Promise<Viewport> {
  const [theme, a11y] = await Promise.all([chosenTheme(), chosenA11y()]);
  return {
    width: "device-width",
    initialScale: 1,
    themeColor:
      a11y && a11y.contrast !== "normal"
        ? CONTRAST_COLOR[a11y.contrast]
        : theme
          ? THEME_COLOR[theme]
          : [
              { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
              { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
            ],
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [theme, a11y, user] = await Promise.all([chosenTheme(), chosenA11y(), getCurrentUser()]);
  // Путеводитель и переключатель ролей — только тем, кто вошёл под одним из демо-аккаунтов.
  const demo = demoEnabled() && user && isDemoLogin(user.login) ? user.login : null;
  return (
    <html lang="ru" data-theme={theme ?? undefined} {...a11yAttributes(a11y)}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="bg-brand text-brand-ink sr-only rounded-lg px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Перейти к содержимому
        </a>
        <ConceptBanner />
        {a11y && <A11yBar initial={a11y} />}
        {children}
        {/* key: после переключения аккаунта путеводитель начинается закрытым. */}
        {demo && <DemoGuide key={demo} me={demo} />}
      </body>
    </html>
  );
}
