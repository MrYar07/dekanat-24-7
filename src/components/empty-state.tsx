import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center">
      <span className="bg-brand-soft text-brand mb-3 rounded-full p-3">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="font-medium">{title}</p>
      {children && <p className="text-muted mt-1 max-w-xs text-sm">{children}</p>}
    </div>
  );
}

export function PageTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {hint && <p className="text-muted mt-1 text-sm">{hint}</p>}
    </div>
  );
}
