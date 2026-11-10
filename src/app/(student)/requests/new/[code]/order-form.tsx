"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { Field } from "@/lib/documents/forms";
import type { OrderState } from "../../actions";

const SELECT =
  "border-border bg-surface focus:border-brand aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border px-3.5 py-3 text-base outline-none";

function SelectField({
  field,
  error,
  value,
}: {
  field: Extract<Field, { kind: "select" }>;
  error?: string;
  value?: string;
}) {
  const known = !value || field.options.includes(value);
  const [choice, setChoice] = useState(known ? (value ?? field.options[0]) : "__other");
  const id = `field-${field.name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {field.label}
      </label>
      <select
        id={id}
        name={field.name}
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        aria-invalid={error && choice !== "__other" ? true : undefined}
        className={SELECT}
      >
        {field.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {field.other && <option value="__other">другое — напишу сам</option>}
      </select>
      {choice === "__other" && (
        <TextField
          className="mt-3"
          label="Куда именно"
          name={`${field.name}_other`}
          defaultValue={known ? "" : value}
          placeholder="Например, в спортивную секцию"
          maxLength={120}
          error={error}
          autoFocus
        />
      )}
      {error && choice !== "__other" && <p className="text-danger mt-1 text-sm">{error}</p>}
    </div>
  );
}

export function OrderForm({
  action,
  fields,
  instant,
}: {
  action: (prev: OrderState, form: FormData) => Promise<OrderState>;
  fields: Field[];
  instant: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      // Без JS форма уходит обычным action. С JS отправляем сами: React 19 после action сбрасывает
      // форму, и <select> показал бы первый вариант, хотя выбрано «другое».
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
      noValidate
    >
      {fields.map((f) => {
        const error = state.fields?.[f.name];
        const value = state.values?.[f.name];
        if (f.kind === "select") return <SelectField key={f.name} field={f} error={error} value={value} />;
        if (f.kind === "number") {
          return (
            <TextField
              key={f.name}
              label={f.label}
              name={f.name}
              type="number"
              inputMode="numeric"
              min={f.min}
              max={f.max}
              defaultValue={value ?? f.min}
              error={error}
              className="max-w-40"
            />
          );
        }
        return (
          <div key={f.name}>
            <TextField
              label={f.optional ? `${f.label} (необязательно)` : f.label}
              name={f.name}
              placeholder={f.placeholder}
              defaultValue={value}
              maxLength={200}
              error={error}
              aria-describedby={f.hint ? `field-${f.name}-hint` : undefined}
            />
            {f.hint && (
              <p id={`field-${f.name}-hint`} className="text-muted mt-1 text-sm">
                {f.hint}
              </p>
            )}
          </div>
        );
      })}

      {state.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
        {pending ? (instant ? "Формируем…" : "Отправляем…") : instant ? "Сформировать PDF" : "Отправить в деканат"}
      </Button>
    </form>
  );
}
