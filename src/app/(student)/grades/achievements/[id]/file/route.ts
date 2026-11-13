import { proofResponse } from "@/lib/achievements/response";
import { takeMyAchievementFile } from "@/lib/data/achievements";

// Файл-подтверждение. Ищется только среди достижений студента из сессии: чужой id → 404.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await takeMyAchievementFile(id);
  if (!file) return new Response("Не найдено", { status: 404 });
  return proofResponse(file);
}
