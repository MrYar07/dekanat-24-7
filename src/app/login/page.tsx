import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { Callout } from "@/components/ui/callout";
import { getCurrentUser, homePathFor } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-10 flex items-center justify-between">
        <Logo withCaption />
        <ThemeToggle className="-mr-2" />
      </div>
      <p className="text-muted mb-1 font-serif text-sm italic">личный кабинет студента</p>
      <h1 className="font-serif text-[28px] leading-tight font-bold">Вход в кабинет</h1>
      <LoginForm />
      <div className="border-border mt-10 border-t pt-4">
        <Callout tone="info" lead="Пароль один на все аккаунты.">
          Он указан в комментарии к конкурсной работе. После входа внизу появится «Путеводитель»: он проведёт по
          сценариям и переключит между студентом, преподавателем и деканатом без повторного входа.
        </Callout>
      </div>
    </main>
  );
}
