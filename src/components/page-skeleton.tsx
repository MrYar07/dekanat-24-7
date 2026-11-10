import { Skeleton } from "@/components/ui/states";

/** Заглушка загрузки раздела. Подключается через loading.tsx только в тех разделах,
 * где нет страниц с notFound(): иначе потоковая отдача начнётся раньше и 404 станет 200. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <Skeleton className="mb-2 h-4 w-40" />
      <Skeleton className="mb-6 h-8 w-2/3" />
      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="mb-3 h-3 w-32" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
