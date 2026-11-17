import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, ShieldX } from "lucide-react";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { Seal } from "@/components/ui/status";
import { verifyStudentCard } from "@/lib/data/card";

export const metadata: Metadata = { title: "Проверка студенческого" };

const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });
const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// Публичная страница: без входа. Охранник или библиотекарь сверяет фамилию с тем, кто стоит перед ним.
export default async function VerifyCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = await verifyStudentCard(decodeURIComponent(token));
  if (!card) notFound();
  const until = card.validUntil ? day.format(new Date(`${card.validUntil}T12:00:00+03:00`)) : null;

  return (
    <main id="main" className="mx-auto w-full max-w-md px-4 py-10">
      <Logo withCaption className="mb-8" />
      <p className="text-muted mb-1 font-serif text-sm italic">проверка студенческого · {time.format(new Date())}</p>
      <h1 className="flex items-center gap-2 font-serif text-[1.625rem] leading-tight font-bold">
        {card.fresh ? (
          <ShieldCheck className="text-ok size-7 shrink-0" aria-hidden="true" />
        ) : (
          <ShieldX className="text-danger size-7 shrink-0" aria-hidden="true" />
        )}
        {card.fresh ? "Студент «Меридиана»" : "QR-код устарел"}
      </h1>

      {card.fresh ? (
        <>
          <Card className="relative mt-12">
            <div className="absolute -top-9 right-3">
              <Seal size={92}>действует</Seal>
            </div>
            <p className="pr-24 font-serif text-lg leading-snug font-bold">{card.holder}</p>
            {/* Подпись над значением: название факультета длинное и в строку «подпись … значение» не помещается. */}
            <dl className="divide-border mt-3 divide-y text-sm">
              {[
                ["Факультет", card.faculty],
                ["Курс", `${card.course}-й`],
                ...(until ? [["Студенческий действует до", until]] : []),
              ].map(([k, v]) => (
                <div key={k} className="py-2">
                  <dt className="text-muted text-xs">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <p className="text-muted mt-4 text-xs">
            Сверь фамилию с документом, если нужно. QR на экране студента меняется каждую минуту, поэтому снимок экрана
            здесь не пройдёт.
          </p>
        </>
      ) : (
        <p className="text-muted mt-3 text-sm">
          Этот код показывали больше двух минут назад. Попроси открыть студенческий в кабинете ещё раз: QR обновится сам.
        </p>
      )}
    </main>
  );
}
