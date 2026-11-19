import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

// Заголовок вкладки для адреса, которого нет. Страница, сама вызвавшая notFound(), оставляет свой.
export const metadata: Metadata = { title: "Такой страницы нет" };

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-sm px-4 py-20 text-center">
      <p className="text-brand font-serif text-6xl font-bold">404</p>
      <h1 className="mt-3 font-serif text-xl font-bold">Такой страницы нет</h1>
      <p className="text-muted mt-1 text-sm">Или к ней нет доступа.</p>
      <Link href="/" className={buttonClass("primary", "mt-6")}>
        На главную
      </Link>
    </main>
  );
}
