import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { requireRole } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Кабинет сотрудника" };

const ROLE_LABEL = { teacher: "Преподаватель", dean_office: "Деканат" } as const;

export default async function StaffPage() {
  const user = await requireRole("teacher", "dean_office");
  const role = user.role as keyof typeof ROLE_LABEL;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <form action={logout}>
          <button type="submit" className="text-muted hover:text-text flex items-center gap-2 text-sm">
            <LogOut className="size-4" aria-hidden="true" />
            Выйти
          </button>
        </form>
      </header>
      <h1 className="text-2xl font-semibold">
        {user.firstName} {user.middleName}
      </h1>
      <p className="text-muted mt-1 text-sm">{ROLE_LABEL[role]}</p>
      <div className="border-border bg-surface mt-6 rounded-2xl border border-dashed p-6 text-sm">
        {role === "teacher"
          ? "Здесь будет журнал групп: посещаемость, баллы за срезы и оценки сессии."
          : "Здесь будет очередь заявок студентов, подтверждение достижений и объявления."}
      </div>
    </main>
  );
}
