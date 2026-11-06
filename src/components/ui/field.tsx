import type { ComponentProps } from "react";

/** Поле формы с подписью. Ошибку показываем под полем и связываем через aria-describedby. */
export function TextField({
  label,
  error,
  id,
  name,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; error?: string; name: string }) {
  const inputId = id ?? `field-${name}`;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className="border-border bg-surface focus:border-brand aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border px-3.5 py-3 text-base outline-none"
        {...props}
      />
      {error && (
        <p id={errorId} className="text-danger mt-1 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
