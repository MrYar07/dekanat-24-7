import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { CoverNav } from "@/components/cover-nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";

/**
 * Обложка зачётки — боковая панель на широком экране. Тёмно-синяя, как переплёт зачётной книжки:
 * знак кабинета, «титульный лист» с тем, чей это кабинет, разделы-закладки, внизу тема и выход.
 * Панель тянется на всю высоту страницы, а её содержимое остаётся на экране при прокрутке.
 */
export function Cover({
  home,
  kind,
  unread,
  initials,
  name,
  lines,
}: {
  home: string;
  kind: "student" | "dean" | "teacher";
  unread?: number;
  initials: string;
  name: string;
  /** Строки под именем: группа и номер зачётки у студента, должность у сотрудника. */
  lines: string[];
}) {
  return (
    <aside className="cover bg-cover text-cover-ink border-cover-line hidden border-r md:block md:w-64 md:shrink-0">
      <div className="sticky top-0 flex h-[calc(100dvh-2rem)] min-h-[32rem] flex-col overflow-y-auto py-6 pl-5">
        <Link href={home} aria-label="Деканат 24/7, на главную" className="mr-5 self-start">
          <Logo withCaption tone="cover" />
        </Link>

        {/* Титульный лист: чья это зачётка. */}
        <div className="border-cover-line mt-6 mr-5 flex items-center gap-3 border-y py-4">
          <span
            aria-hidden="true"
            className="border-cover-muted grid size-11 shrink-0 place-items-center rounded-full border font-serif text-sm font-bold"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-serif leading-snug font-bold">{name}</p>
            {lines.map((line) => (
              <p key={line} className="text-cover-muted truncate text-xs leading-snug">
                {line}
              </p>
            ))}
          </div>
        </div>

        <CoverNav kind={kind} unread={unread} />

        <div className="mt-auto mr-5 flex items-center justify-between pt-6">
          <ThemeToggle tone="cover" className="-ml-2" />
          <form action={logout}>
            <button
              type="submit"
              className="text-cover-muted hover:bg-cover-hover hover:text-cover-ink -mr-2 inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Выйти
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

/** Шапка на телефоне: та же обложка, узкой полосой. Справа — то, что нужно под пальцем. */
export function CoverBar({ home, children }: { home: string; children: React.ReactNode }) {
  return (
    <header className="cover bg-cover text-cover-ink flex items-center justify-between gap-3 px-4 py-2.5 md:hidden">
      <Link href={home} aria-label="Деканат 24/7, на главную">
        <Logo withCaption tone="cover" />
      </Link>
      <div className="flex items-center">{children}</div>
    </header>
  );
}
