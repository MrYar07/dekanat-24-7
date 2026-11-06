import { TriangleAlert, type LucideIcon } from "lucide-react";

/** Пустое состояние. Текст всегда подсказывает, что будет здесь или что сделать дальше. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border flex flex-col items-center rounded-xl border border-dashed px-5 py-6 text-center sm:py-8">
      <span className="bg-brand-soft text-brand mb-3 rounded-full p-3">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="font-serif text-lg font-bold">{title}</p>
      {children && <p className="text-muted mt-1 max-w-xs text-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Ошибка загрузки. Говорим по-человечески и даём кнопку «попробовать ещё раз». */
export function ErrorState({
  title = "Не получилось загрузить",
  children = "Проверь интернет и попробуй ещё раз через минуту.",
  action,
}: {
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div role="alert" className="bg-danger-soft flex flex-col items-center rounded-xl px-6 py-8 text-center">
      <TriangleAlert className="text-danger mb-3 size-7" aria-hidden="true" />
      <p className="font-serif text-lg font-bold">{title}</p>
      <p className="text-muted mt-1 max-w-xs text-sm">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Заглушка на время загрузки. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`bg-surface-2 animate-pulse rounded-md ${className}`} />;
}
