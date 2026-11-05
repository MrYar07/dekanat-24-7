import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { PageTitle } from "@/components/empty-state";
import { getMyProfile } from "@/lib/data/student";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Профиль" };

export default async function ProfilePage() {
  const p = await getMyProfile();
  const fullName = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ");

  const rows: [string, string][] = [
    ["Факультет", p.faculty],
    ["Направление", `${p.programCode} ${p.program}`],
    ["Курс", String(p.course)],
    ["Группа", p.group],
    ["Номер зачётки", p.recordBookNumber],
    ["Форма обучения", p.isPaid ? "Платная" : "Бюджетная"],
  ];

  return (
    <>
      <PageTitle>Профиль</PageTitle>
      <section className="bg-surface border-border rounded-2xl border p-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="bg-brand-soft text-brand flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
          >
            {p.firstName[0]}
            {p.lastName[0]}
          </span>
          <div>
            <p className="text-lg font-semibold">{fullName}</p>
            <p className="text-muted text-sm">Студент, {p.group}</p>
          </div>
        </div>
        <dl className="divide-border mt-5 divide-y text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
              <dt className="text-muted sm:w-40 sm:shrink-0">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <form action={logout} className="mt-4">
        <button
          type="submit"
          className="border-border bg-surface text-danger flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium"
        >
          <LogOut className="size-5" aria-hidden="true" />
          Выйти
        </button>
      </form>
    </>
  );
}
