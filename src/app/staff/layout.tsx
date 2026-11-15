import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Cover, CoverBar } from "@/components/cover";
import { DeanNav } from "@/components/staff-nav";
import { ThemeToggle } from "@/components/theme";
import { requireRole } from "@/lib/auth/dal";

const ROLE = {
  teacher: { kind: "teacher", label: "преподаватель" },
  dean_office: { kind: "dean", label: "сотрудник деканата" },
} as const;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("teacher", "dean_office");
  const role = ROLE[user.role as keyof typeof ROLE];

  return (
    <div className="md:flex">
      {/* Широкий экран: обложка слева. Телефон: полоса обложки сверху, у деканата под ней вкладки. */}
      <Cover
        home="/staff"
        kind={role.kind}
        initials={`${user.firstName[0]}${user.lastName[0]}`}
        name={`${user.lastName} ${user.firstName[0]}.${user.middleName ? ` ${user.middleName[0]}.` : ""}`}
        lines={[role.label]}
      />
      <CoverBar home="/staff">
        <ThemeToggle tone="cover" />
        <form action={logout}>
          <button type="submit" aria-label="Выйти" className="text-cover-muted hover:text-cover-ink -mr-2 rounded-full p-2">
            <LogOut className="size-5" aria-hidden="true" />
          </button>
        </form>
      </CoverBar>

      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 pt-3 pb-10 md:px-10 md:pt-8">
          {user.role === "dean_office" && (
            <div className="md:hidden">
              <DeanNav />
            </div>
          )}
          <main id="main" className={user.role === "dean_office" ? "" : "pt-2 md:pt-0"}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
