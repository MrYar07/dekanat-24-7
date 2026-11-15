"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { DEMO_ACCOUNTS, DEMO_LOGINS } from "@/lib/demo/accounts";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const loginField = useRef<HTMLInputElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {/* Тестовые аккаунты: нажатие подставляет логин, остаётся ввести пароль. */}
      <fieldset>
        <legend className="text-sm font-medium">Тестовые аккаунты</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {DEMO_LOGINS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                if (loginField.current) loginField.current.value = name;
                passwordField.current?.focus();
              }}
              className="border-border hover:bg-surface-2 rounded-lg border px-3 py-2 text-left text-sm"
            >
              <span className="block font-semibold">{DEMO_ACCOUNTS[name].name}</span>
              <span className="text-muted block text-xs">
                {DEMO_ACCOUNTS[name].role} · <code>{name}</code>
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <TextField
        ref={loginField}
        label="Логин"
        name="login"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.login}
        aria-invalid={!!state.error}
      />
      <TextField
        ref={passwordField}
        label="Пароль"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={!!state.error}
      />
      {state.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full py-3">
        {pending ? "Входим…" : "Войти"}
      </Button>
    </form>
  );
}
