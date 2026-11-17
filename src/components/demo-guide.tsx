"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Compass, X } from "lucide-react";
import { switchDemoAccountAction } from "@/app/demo-actions";
import { buttonClass } from "@/components/ui/button";
import { DEMO_ACCOUNTS, DEMO_LOGINS, type DemoLogin } from "@/lib/demo/accounts";
import { advance, back, EMPTY_GUIDE, parseGuide, SCENARIOS, type GuideState, type ScenarioStep } from "@/lib/demo/scenarios";

// Путеводитель для жюри: переключение между демо-аккаунтами и восемь сценариев по шагам.
// Прогресс лежит в localStorage браузера: он переживает переключение аккаунта и на сервер не уходит.

const KEY = "d247_guide";
const EVENT = "d247-guide";
/** Запас на случай, когда localStorage недоступен (приватный режим): прогресс живёт до перезагрузки. */
let memory: string | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}
function read(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}
function write(next: GuideState) {
  memory = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, memory);
  } catch {
    // Останется в памяти вкладки.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Кто действует на шаге — для фразы «Дальше — …». */
const WHO: Record<DemoLogin, string> = {
  student1: "Алина, студентка 2 курса",
  student2: "Матвей, студент 3 курса",
  teacher: "преподаватель",
  dean: "деканат",
};
/** «Продолжить как …». */
const AS: Record<DemoLogin, string> = { student1: "Алина", student2: "Матвей", teacher: "преподаватель", dean: "деканат" };

function SwitchButton({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Переключаем…" : children}
    </button>
  );
}

/** Форма переключения аккаунта. next — куда попасть после переключения (по умолчанию — главная роли). */
function SwitchForm({
  login,
  next,
  children,
  className,
}: {
  login: DemoLogin;
  next?: string;
  children: React.ReactNode;
  className: string;
}) {
  return (
    <form action={switchDemoAccountAction} className="contents">
      <input type="hidden" name="login" value={login} />
      {next && <input type="hidden" name="next" value={next} />}
      <SwitchButton className={className}>{children}</SwitchButton>
    </form>
  );
}

function StepBody({ step, me, pathname }: { step: ScenarioStep; me: DemoLogin; pathname: string }) {
  // Шаг другого участника: сначала нужно стать им.
  if (step.as !== "anyone" && step.as !== me) {
    const carry = step.carryUrl ? new RegExp(step.carryUrl).test(pathname) : false;
    if (step.carryUrl && !carry) {
      return <p className="mt-2 text-sm leading-snug">{step.carryHint}</p>;
    }
    return (
      <>
        <p className="mt-2 text-sm leading-snug">
          {step.carryUrl ? `Теперь ту же страницу открывает ${WHO[step.as]}.` : `Дальше — ${WHO[step.as]}.`}
        </p>
        <div className="mt-3">
          <SwitchForm login={step.as} next={step.carryUrl ? pathname : step.href} className={buttonClass("primary", "w-full py-2 text-sm")}>
            {step.carryUrl ? `Открыть эту страницу как ${AS[step.as]}` : `Продолжить как ${AS[step.as]}`}
          </SwitchForm>
        </div>
      </>
    );
  }
  return <p className="mt-2 text-sm leading-snug">{step.text}</p>;
}

export function DemoGuide({ me }: { me: DemoLogin }) {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const state = useMemo(() => parseGuide(raw), [raw]);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const scenario = state.scenario === null ? null : SCENARIOS[state.scenario];
  const step = scenario?.steps[state.step] ?? null;
  const mine = step !== null && (step.as === "anyone" || step.as === me);
  const last = scenario !== null && state.step === scenario.steps.length - 1;
  // У студента на телефоне внизу панель вкладок: всё плавающее поднимаем над ней.
  const lift = me.startsWith("student") ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6" : "bottom-4 md:bottom-6";

  return (
    <>
      {scenario && step && !state.collapsed ? (
        <>
          {/* Место под плашку, чтобы она не закрывала конец страницы. */}
          <div aria-hidden="true" className="h-44" />
          <section
            aria-label="Путеводитель: текущий шаг"
            className={`border-border bg-surface sheet-in fixed inset-x-3 z-30 mx-auto max-w-md rounded-xl border p-3 shadow-lg md:inset-x-auto md:right-6 md:w-96 ${lift}`}
          >
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => setOpen(true)} className="min-w-0 text-left">
                <span className="text-muted block text-xs">
                  Сценарий {state.scenario! + 1} из {SCENARIOS.length} · шаг {state.step + 1} из {scenario.steps.length}
                </span>
                <span className="block truncate font-serif font-bold">{scenario.title}</span>
              </button>
              <div className="-mt-1 -mr-1 flex shrink-0">
                <button
                  type="button"
                  aria-label="Свернуть подсказку"
                  onClick={() => write({ ...state, collapsed: true })}
                  className="text-muted hover:text-text rounded p-1.5"
                >
                  <ChevronDown className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Выйти из сценария"
                  onClick={() => write({ ...state, scenario: null, step: 0 })}
                  className="text-muted hover:text-text rounded p-1.5"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div aria-live="polite">
              <StepBody step={step} me={me} pathname={pathname} />
            </div>

            <div className={`mt-3 flex flex-wrap items-center gap-2 ${mine || state.step > 0 ? "" : "hidden"}`}>
              {state.step > 0 && (
                <button type="button" onClick={() => write(back(state))} className={buttonClass("ghost", "px-2.5 py-1.5 text-sm")}>
                  Назад
                </button>
              )}
              <span className="flex-1" />
              {mine && step.href && pathname !== step.href && !step.carryUrl && (
                <Link href={step.href} className={buttonClass("secondary", "px-3 py-1.5 text-sm")}>
                  Открыть страницу
                </Link>
              )}
              {mine && (
                <button
                  type="button"
                  onClick={() => {
                    write(advance(state));
                    if (last) setOpen(true);
                  }}
                  className={buttonClass("primary", "px-3.5 py-1.5 text-sm")}
                >
                  {last ? "Готово" : "Дальше"}
                </button>
              )}
            </div>
          </section>
        </>
      ) : (
        <button
          type="button"
          onClick={() => (scenario ? write({ ...state, collapsed: false }) : setOpen(true))}
          className={`border-border bg-surface text-text hover:bg-surface-2 fixed right-3 z-30 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium shadow-lg md:right-6 ${lift}`}
        >
          {scenario ? <ChevronUp className="text-brand size-4" aria-hidden="true" /> : <Compass className="text-brand size-4" aria-hidden="true" />}
          {scenario ? `Сценарий ${state.scenario! + 1} · шаг ${state.step + 1} из ${scenario.steps.length}` : "Путеводитель"}
          {!scenario && state.done.length > 0 && (
            <span className="text-muted text-xs tabular-nums">
              {state.done.length} из {SCENARIOS.length}
            </span>
          )}
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="guide-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // Щелчок по затемнению вокруг окна закрывает его.
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="bg-surface text-text border-border m-0 mt-auto max-h-[88dvh] w-full max-w-full overflow-y-auto overscroll-contain rounded-t-2xl border p-0 backdrop:bg-black/45 md:m-auto md:max-w-lg md:rounded-2xl"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted font-serif text-sm italic">демо для жюри</p>
              <h2 id="guide-title" className="font-serif text-2xl leading-tight font-bold">
                Путеводитель
              </h2>
            </div>
            <button
              type="button"
              aria-label="Закрыть путеводитель"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-text -mt-1 -mr-2 rounded-full p-2"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-muted mt-1 text-sm">
            Восемь сценариев показывают кабинет целиком. Данные сбрасываются каждую ночь, так что ломать не страшно.
          </p>

          <h3 className="text-muted mt-5 mb-2 text-[0.8125rem] font-semibold">Смотреть как</h3>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_LOGINS.map((login) => {
              const a = DEMO_ACCOUNTS[login];
              const label = (
                <>
                  <span className="block font-semibold">{a.name}</span>
                  <span className="block text-xs font-normal opacity-80">{login === me ? "сейчас" : a.role}</span>
                </>
              );
              return login === me ? (
                <div key={login} aria-current="true" className="border-brand bg-brand-soft text-brand rounded-lg border px-3 py-2 text-sm">
                  {label}
                </div>
              ) : (
                <SwitchForm
                  key={login}
                  login={login}
                  className="border-border hover:bg-surface-2 w-full rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-60"
                >
                  {label}
                </SwitchForm>
              );
            })}
          </div>

          <div className="mt-6 mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-muted text-[0.8125rem] font-semibold">Сценарии</h3>
            <p className="text-muted text-xs tabular-nums">
              пройдено {state.done.length} из {SCENARIOS.length}
            </p>
          </div>
          <ol className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {SCENARIOS.map((sc, i) => {
              const done = state.done.includes(i);
              const active = state.scenario === i;
              return (
                <li key={sc.title}>
                  <button
                    type="button"
                    onClick={() => {
                      write({ ...state, scenario: i, step: active ? state.step : 0, collapsed: false });
                      setOpen(false);
                    }}
                    className={`hover:bg-surface-2 flex w-full items-start gap-3 px-3.5 py-3 text-left ${active ? "bg-brand-soft" : ""}`}
                  >
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums ${
                        done ? "border-stamp text-stamp" : active ? "border-brand text-brand" : "border-border text-muted"
                      }`}
                    >
                      {done ? <Check className="size-3.5" aria-label="пройден" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{sc.title}</span>
                      <span className="text-muted block text-sm">
                        {active ? `Продолжить с шага ${state.step + 1} из ${sc.steps.length}` : sc.summary}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {(state.done.length > 0 || state.scenario !== null) && (
            <button type="button" onClick={() => write(EMPTY_GUIDE)} className="text-muted hover:text-text mt-3 text-sm underline">
              Начать путеводитель заново
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
