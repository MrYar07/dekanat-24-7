import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { DeanNav } from "@/components/staff-nav";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";

const ROLE_LABEL = { teacher: "преподаватель", dean_office: "деканат" } as const;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("teacher", "dean_office");
  const role = ROLE_LABEL[user.role as keyof typeof ROLE_LABEL];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-3 md:px-6 md:py-5">
      <header
        className={`flex items-center justify-between gap-3 pb-3 ${user.role === "dean_office" ? "" : "border-border mb-6 border-b"}`}
      >
        <Link href="/staff" aria-label="Деканат 24/7, кабинет сотрудника">
          <Logo withCaption />
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-muted hidden min-w-0 truncate text-right text-sm sm:block">
            {user.lastName} {user.firstName[0]}.{user.middleName ? ` ${user.middleName[0]}.` : ""} · {role}
          </p>
          <ThemeToggle />
          <form action={logout}>
            {/* На телефоне рядом логотип и кнопка темы: подпись не помещается в 360 px, остаётся значок. */}
            <Button type="submit" variant="ghost" aria-label="Выйти" className="px-2.5 text-sm sm:px-3">
              <LogOut className="size-5 sm:size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </form>
        </div>
      </header>
      {user.role === "dean_office" && <DeanNav />}
      <main id="main" className="pb-10">{children}</main>
    </div>
  );
}
