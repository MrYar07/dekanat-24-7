export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Загрузка" className="animate-pulse space-y-3">
      <div className="bg-surface-2 h-8 w-2/3 rounded-lg" />
      <div className="bg-surface-2 h-4 w-1/3 rounded" />
      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <div className="bg-surface-2 h-36 rounded-2xl" />
        <div className="bg-surface-2 h-36 rounded-2xl" />
      </div>
    </div>
  );
}
