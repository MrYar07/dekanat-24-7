import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-sm px-4 py-20 text-center">
      <p className="text-brand font-serif text-6xl font-bold">404</p>
      <h1 className="mt-3 font-serif text-xl font-bold">Такой страницы нет</h1>
      <p className="text-muted mt-1 text-sm">Или у тебя нет к ней доступа.</p>
      <Link href="/" className={buttonClass("primary", "mt-6")}>
        На главную
      </Link>
    </main>
  );
}
