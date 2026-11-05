import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentUser, homePathFor } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col justify-center px-4 py-10">
      <Logo className="mb-8 text-lg" />
      <h1 className="text-2xl font-semibold">Вход в кабинет</h1>
      <p className="text-muted mt-1 text-sm">Университет «Меридиан»</p>
      <LoginForm />
      <div className="border-border text-muted mt-8 rounded-xl border p-4 text-sm">
        <p className="text-text font-medium">Тестовые аккаунты</p>
        <p className="mt-1">
          Студенты: <code>student1</code>, <code>student2</code>. Преподаватель: <code>teacher</code>. Деканат:{" "}
          <code>dean</code>.
        </p>
        <p className="mt-1">Пароль — в комментарии к конкурсной работе.</p>
      </div>
    </main>
  );
}
