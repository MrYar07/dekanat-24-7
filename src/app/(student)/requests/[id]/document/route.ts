import { takeMyDocument } from "@/lib/data/requests";
import { renderDocument } from "@/lib/documents/pdf";
import { verifyUrl } from "@/lib/site";

// PDF справки. Документ ищется только среди заявок студента из сессии: чужой id → 404.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await takeMyDocument(id);
  if (!doc) return new Response("Не найдено", { status: 404 });

  const bytes = await renderDocument(doc.snapshot, {
    number: doc.number,
    issuedAt: doc.issuedAt,
    code: doc.code,
    verifyUrl: await verifyUrl(doc.code),
  });
  const ascii = `meridian-${doc.snapshot.kind}-${doc.number.replace(/[^\dA-Za-z-]/g, "")}.pdf`;
  const name = `${doc.snapshot.kind === "study" ? "Справка" : "Выписка"} ${doc.number}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
