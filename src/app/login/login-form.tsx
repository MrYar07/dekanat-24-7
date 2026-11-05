"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const inputClass =
  "bg-surface border-border mt-1 block w-full rounded-xl border px-3.5 py-3 text-base outline-none focus:border-brand";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <label className="block text-sm font-medium">
        Логин
        <input
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.login}
          aria-invalid={!!state.error}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.error}
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-xl px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand text-brand-ink w-full rounded-xl px-4 py-3 font-medium disabled:opacity-60"
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
