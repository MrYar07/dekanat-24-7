import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/logo";

export default function CardNotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-md px-4 py-10">
      <Logo withCaption className="mb-8" />
      <p className="text-muted mb-1 font-serif text-sm italic">проверка студенческого</p>
      <h1 className="flex items-center gap-2 font-serif text-[26px] leading-tight font-bold">
        <ShieldAlert className="text-warn size-7 shrink-0" aria-hidden="true" />
        Код не найден
      </h1>
      <p className="text-muted mt-3 text-sm">
        Такого кода нет или он давно устарел. Попроси студента открыть электронный студенческий в кабинете ещё раз.
      </p>
    </main>
  );
}
