// Ответ с файлом-подтверждением. Тип берётся из базы, куда он записан по содержимому файла,
// поэтому в ответе может быть только PDF, PNG или JPEG. nosniff и CSP добавляет next.config.ts.

export function proofResponse(file: { name: string; mime: string; data: Buffer }) {
  const ascii = `proof.${file.name.split(".").pop() ?? "bin"}`;
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
