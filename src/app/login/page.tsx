import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { Callout } from "@/components/ui/callout";
import { getCurrentUser, homePathFor } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <div className="md:grid md:min-h-[calc(100dvh-2rem)] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Обложка зачётки: на широком экране — левая половина, на телефоне — полоса над формой. */}
      <div className="cover bg-cover text-cover-ink relative flex flex-col px-6 py-7 md:px-12 md:py-12">
        {/* Рамка-тиснение, как на переплёте. */}
        <div aria-hidden="true" className="border-cover-line pointer-events-none absolute inset-3 hidden rounded-sm border md:block" />
        <div className="flex items-center justify-between gap-3 md:block">
          <div className="flex items-center gap-3 md:block">
            <LogoMark size={44} className="md:hidden" />
            <LogoMark size={76} className="hidden md:block" />
            <div className="md:mt-8">
              <p className="font-serif text-2xl leading-tight font-bold tracking-[-0.01em] md:text-[44px] md:leading-[1.05]">
                Деканат 24/7
              </p>
              <p className="text-cover-muted font-serif text-sm italic md:mt-2 md:text-base">университет «Меридиан»</p>
            </div>
          </div>
          <ThemeToggle tone="cover" className="-mr-2 md:absolute md:top-8 md:right-8" />
        </div>
        <p className="mt-auto hidden max-w-sm pt-10 font-serif text-xl leading-snug md:block">
          Ни одного лишнего похода в деканат и ни одной оценки, о которой узнаёшь в конце триместра.
        </p>
      </div>

      <main id="main" className="mx-auto flex w-full max-w-sm flex-col justify-center px-4 py-8 md:py-10">
        <h1 className="font-serif text-[28px] leading-[1.15] font-bold tracking-[-0.01em]">Вход в кабинет</h1>
        <LoginForm />
        <div className="border-border mt-8 border-t pt-4">
          <Callout tone="info" lead="Пароль один на все аккаунты.">
            Он указан в комментарии к конкурсной работе. После входа внизу появится «Путеводитель»: он проведёт по
            сценариям и переключит между студентом, преподавателем и деканатом без повторного входа.
          </Callout>
        </div>
      </main>
    </div>
  );
}
