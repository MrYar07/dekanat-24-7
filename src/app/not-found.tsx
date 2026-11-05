import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-sm px-4 py-20 text-center">
      <p className="text-brand text-5xl font-semibold">404</p>
      <h1 className="mt-3 text-xl font-semibold">Такой страницы нет</h1>
      <p className="text-muted mt-1 text-sm">Или у тебя нет к ней доступа.</p>
      <Link href="/" className="bg-brand text-brand-ink mt-6 inline-block rounded-xl px-4 py-2.5 font-medium">
        На главную
      </Link>
    </main>
  );
}
