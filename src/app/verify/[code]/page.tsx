import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { Stamp } from "@/components/ui/status";
import { verifyDocument } from "@/lib/data/requests";

export const metadata: Metadata = { title: "Проверка справки" };

const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });

// Публичная страница: без входа. Показываем только то, что нужно для сверки с бумагой.
export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const doc = await verifyDocument(decodeURIComponent(code));

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <Logo withCaption className="mb-8" />
      <p className="text-muted mb-1 font-serif text-sm italic">проверка подлинности</p>

      {!doc ? (
        <>
          <h1 className="flex items-center gap-2 font-serif text-[26px] leading-tight font-bold">
            <ShieldAlert className="text-warn size-7 shrink-0" aria-hidden="true" />
            Документ не найден
          </h1>
          <p className="text-muted mt-3 text-sm">
            Справки с таким кодом нет. Проверь, что код введён без ошибок, или попроси владельца справки прислать ссылку
            из личного кабинета.
          </p>
        </>
      ) : (
        <>
          <h1 className="flex items-center gap-2 font-serif text-[26px] leading-tight font-bold">
            {doc.valid ? (
              <ShieldCheck className="text-ok size-7 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldX className="text-danger size-7 shrink-0" aria-hidden="true" />
            )}
            {doc.valid ? "Справка действительна" : "Справка отозвана"}
          </h1>
          <Card className="mt-6">
            <div className="flex items-start justify-between gap-3">
              <p className="font-serif text-lg leading-snug font-bold">{doc.type}</p>
              {doc.valid && <Stamp>подлинная</Stamp>}
            </div>
            <Ledger className="mt-4">
              <LedgerRow label="Номер" value={doc.number} />
              <LedgerRow label="Выдана" value={<span className="font-sans text-sm font-normal">{day.format(doc.issuedAt)}</span>} />
              <LedgerRow label="Кому" value={<span className="font-sans text-sm font-normal">{doc.holder}</span>} />
            </Ledger>
          </Card>
          <p className="text-muted mt-4 text-xs">
            Сверь номер и фамилию с бумажной или PDF-версией. Остальные данные студента здесь не показываются.
          </p>
        </>
      )}

      <Link href="/verify" className="text-brand mt-8 inline-block text-sm font-semibold hover:underline">
        Проверить другой код
      </Link>
    </main>
  );
}
