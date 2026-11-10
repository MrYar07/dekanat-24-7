import { getMyNotificationState } from "@/lib/data/notifications";

// Короткое состояние уведомлений для обновления без перезагрузки (см. components/live-updates.tsx).
export async function GET() {
  return Response.json(await getMyNotificationState(), { headers: { "Cache-Control": "private, no-store" } });
}
