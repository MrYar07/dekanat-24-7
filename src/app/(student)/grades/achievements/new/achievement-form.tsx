"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FILE_ACCEPT, FILE_MAX, TITLE_MAX, URL_MAX } from "@/lib/achievements";
import type { AchievementFormState } from "../actions";

export type KindOption = { id: string; direction: string; name: string; maxPoints: number };

const SELECT =
  "border-border bg-surface focus:border-brand aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border px-3.5 py-3 text-base outline-none";
const TOO_BIG = "Файл больше 3 МБ. Сожми его или приложи ссылку";

export function AchievementForm({
  action,
  kinds,
  bonusPerPoint,
}: {
  action: (prev: AchievementFormState, form: FormData) => Promise<AchievementFormState>;
  kinds: KindOption[];
  /** Сколько рейтинга даёт один балл достижения. */
  bonusPerPoint: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [kind, setKind] = useState(state.values?.kind ?? "");
  // Размер проверяем сразу в браузере: незачем отправлять файл, который сервер всё равно не примет.
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileTouched, setFileTouched] = useState(false);

  const directions = [...new Set(kinds.map((k) => k.direction))];
  const chosen = kinds.find((k) => k.id === kind);
  const one = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
  // Ошибка сервера про файл актуальна, пока файл не поменяли.
  const fileMessage = fileError ?? (fileTouched ? undefined : state.fields?.file);

  return (
    <form
      action={formAction}
      // Отправляем сами: React 19 после action сбрасывает форму, и выбранный файл с видом достижения пропали бы.
      onSubmit={(e) => {
        e.preventDefault();
        if (fileError) return;
        const data = new FormData(e.currentTarget);
        setFileTouched(false);
        startTransition(() => formAction(data));
      }}
      className="space-y-5"
      noValidate
    >
      <div>
        <label htmlFor="field-kind" className="block text-sm font-medium">
          Вид достижения
        </label>
        <select
          id="field-kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-invalid={state.fields?.kind && !kind ? true : undefined}
          aria-describedby="field-kind-hint"
          className={SELECT}
        >
          <option value="">Выбери из справочника</option>
          {directions.map((d) => (
            <optgroup key={d} label={d}>
              {kinds
                .filter((k) => k.direction === d)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <p id="field-kind-hint" className={`mt-1 text-sm ${state.fields?.kind && !kind ? "text-danger" : "text-muted"}`}>
          {state.fields?.kind && !kind
            ? state.fields.kind
            : chosen
              ? `За это дают до ${chosen.maxPoints} баллов — до +${one.format(chosen.maxPoints * bonusPerPoint)} к рейтингу. Сколько именно, решит деканат.`
              : "От вида зависит, сколько баллов можно получить."}
        </p>
      </div>

      <TextField
        label="Что за достижение"
        name="title"
        defaultValue={state.values?.title}
        placeholder="Например: призёр олимпиады по экономике, 2-е место"
        maxLength={TITLE_MAX}
        error={state.fields?.title}
      />

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Подтверждение</legend>
        <p className="text-muted -mt-3 text-sm">Нужен файл или ссылка. Можно и то, и другое.</p>

        <div>
          <label htmlFor="field-file" className="block text-sm font-medium">
            Файл
          </label>
          <input
            id="field-file"
            name="file"
            type="file"
            accept={FILE_ACCEPT}
            aria-invalid={fileMessage ? true : undefined}
            aria-describedby="field-file-hint"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFileTouched(true);
              setFileError(f && f.size > FILE_MAX ? TOO_BIG : null);
            }}
            className="border-border bg-surface text-muted file:bg-surface-2 file:text-text aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          <p id="field-file-hint" role={fileMessage ? "alert" : undefined} className={`mt-1 text-sm ${fileMessage ? "text-danger" : "text-muted"}`}>
            {fileMessage ?? "Диплом, грамота, сертификат или скриншот публикации. PDF, JPG или PNG до 3 МБ."}
          </p>
        </div>

        <TextField
          label="Ссылка"
          name="proofUrl"
          type="url"
          inputMode="url"
          defaultValue={state.values?.proofUrl}
          placeholder="https://…"
          maxLength={URL_MAX}
          error={state.fields?.proofUrl}
        />
      </fieldset>

      {state.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
        {pending ? "Отправляем…" : "Отправить в деканат"}
      </Button>
    </form>
  );
}
