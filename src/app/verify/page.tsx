import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

export const metadata: Metadata = { title: "Проверка справки" };

/** Ручной ввод кода: для тех, кто не может отсканировать QR. */
export default async function VerifyFormPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const clean = code?.trim();
  if (clean) redirect(`/verify/${encodeURIComponent(clean)}`);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <Logo withCaption className="mb-8" />
      <p className="text-muted mb-1 font-serif text-sm italic">проверка подлинности</p>
      <h1 className="font-serif text-[28px] leading-tight font-bold">Проверить справку</h1>
      <p className="text-muted mt-2 text-sm">
        Код проверки напечатан внизу справки, рядом с QR-кодом. Вход в кабинет не нужен.
      </p>
      <form method="get" action="/verify" className="mt-6 space-y-4">
        <TextField label="Код проверки" name="code" required autoComplete="off" spellCheck={false} maxLength={64} />
        <Button type="submit" className="w-full py-3">
          Проверить
        </Button>
      </form>
    </main>
  );
}
