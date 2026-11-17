import { calendarFeed } from "@/lib/data/calendar";

// Лента расписания для календаря. Без входа: Google и Apple забирают её сами по секретной ссылке.
// ?download — тот же файл, но браузер сохраняет его, а не открывает.
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^(.+)\.ics$/.exec(file);
  const ics = m ? await calendarFeed(m[1]) : null;
  if (!ics) return new Response("Ссылка на расписание не найдена или сброшена.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const download = new URL(request.url).searchParams.has("download");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="raspisanie.ics"`,
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
