import { openMyNotification } from "@/lib/data/notifications";

// Открыть уведомление: отметить прочитанным и перейти по его ссылке. Чужое или несуществующее — 404.
// Обычный GET без страницы: на него ведёт <a>, а не <Link>, чтобы предзагрузка не отмечала прочитанным.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = await openMyNotification(id);
  if (!target) return new Response("Не найдено", { status: 404 });
  // Относительный адрес: за прокси приложение не знает свой внешний хост, и он здесь не нужен.
  return new Response(null, { status: 303, headers: { Location: target.href, "Cache-Control": "no-store" } });
}
