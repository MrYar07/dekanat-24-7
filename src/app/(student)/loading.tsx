import { Skeleton } from "@/components/ui/states";

export default function Loading() {
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
