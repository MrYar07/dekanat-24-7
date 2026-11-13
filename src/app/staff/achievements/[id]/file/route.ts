import { proofResponse } from "@/lib/achievements/response";
import { takeAchievementFileForDean } from "@/lib/data/staff/dean-achievements";

// Файл-подтверждение для проверки. Роль деканата проверяет слой данных: студента и преподавателя он не пустит.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await takeAchievementFileForDean(id);
  if (!file) return new Response("Не найдено", { status: 404 });
  return proofResponse(file);
}
