import { describe, expect, it } from "vitest";
import { checkDecision, checkSubmission, cleanFileName, FILE_MAX, normalizeProofUrl, sniffMime, type SubmissionInput } from "./index";

const KIND = "3f2b1c9e-7a4d-4e1b-9c3a-5d6e7f8a9b0c";
const pdf = (size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
  return bytes;
};
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const input = (over: Partial<SubmissionInput> = {}): SubmissionInput => ({
  kind: KIND,
  title: "Призёр олимпиады по экономике",
  proofUrl: "",
  file: { name: "диплом.pdf", bytes: pdf() },
  ...over,
});

describe("файл-подтверждение", () => {
  it("тип определяется по содержимому, а не по имени", () => {
    expect(sniffMime(pdf())).toBe("application/pdf");
    expect(sniffMime(png())).toBe("image/png");
    expect(sniffMime(jpg())).toBe("image/jpeg");
    // Страница с кодом под видом картинки.
    expect(sniffMime(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(new Uint8Array())).toBeNull();
  });

  it("имя файла: без пути и служебных символов, расширение — по настоящему типу", () => {
    expect(cleanFileName("C:\\Users\\me\\диплом.pdf", "application/pdf")).toBe("диплом.pdf");
    expect(cleanFileName("../../etc/passwd", "image/png")).toBe("passwd.png");
    expect(cleanFileName('скан "1"<>.exe', "image/jpeg")).toBe("скан 1.jpg");
    expect(cleanFileName("", "application/pdf")).toBe("подтверждение.pdf");
    expect(cleanFileName("a".repeat(300) + ".pdf", "application/pdf")).toHaveLength(84);
  });

  it("исполняемый файл с расширением .pdf не проходит", () => {
    const r = checkSubmission(input({ file: { name: "диплом.pdf", bytes: new Uint8Array([0x4d, 0x5a, 0x90, 0]) } }));
    expect(r).toMatchObject({ ok: false, fields: { file: expect.stringContaining("PDF, JPG или PNG") } });
  });

  it("файл больше предела не проходит", () => {
    const r = checkSubmission(input({ file: { name: "скан.pdf", bytes: pdf(FILE_MAX + 1) } }));
    expect(r).toMatchObject({ ok: false, fields: { file: expect.stringContaining("3 МБ") } });
    expect(checkSubmission(input({ file: { name: "скан.pdf", bytes: pdf(FILE_MAX) } })).ok).toBe(true);
  });
});

describe("ссылка-подтверждение", () => {
  it("принимает только http(s)", () => {
    expect(normalizeProofUrl("  https://example.org/diploma?id=1 ")).toEqual({ ok: true, url: "https://example.org/diploma?id=1" });
    expect(normalizeProofUrl("")).toEqual({ ok: true, url: null });
    expect(normalizeProofUrl("javascript:alert(1)").ok).toBe(false);
    expect(normalizeProofUrl("data:text/html,<script>1</script>").ok).toBe(false);
    expect(normalizeProofUrl("просто текст").ok).toBe(false);
    expect(normalizeProofUrl(`https://example.org/${"a".repeat(300)}`).ok).toBe(false);
  });
});

describe("заявка студента", () => {
  it("с файлом или со ссылкой проходит, название приводится в порядок", () => {
    const withFile = checkSubmission(input({ title: "  Призёр   олимпиады  по экономике " }));
    expect(withFile).toMatchObject({
      ok: true,
      value: { title: "Призёр олимпиады по экономике", proofUrl: null, file: { name: "диплом.pdf", mime: "application/pdf" } },
    });
    const withLink = checkSubmission(input({ file: null, proofUrl: "https://example.org/a" }));
    expect(withLink).toMatchObject({ ok: true, value: { file: null, proofUrl: "https://example.org/a" } });
  });

  it("без подтверждения не проходит", () => {
    expect(checkSubmission(input({ file: null }))).toMatchObject({ ok: false, fields: { file: expect.stringContaining("Нужно подтверждение") } });
  });

  it("ошибки собираются по полям", () => {
    const r = checkSubmission({ kind: "", title: "ой", proofUrl: "ftp://files", file: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(["kind", "proofUrl", "title"]);
    expect(checkSubmission(input({ title: "я".repeat(151) }))).toMatchObject({ ok: false, fields: { title: expect.any(String) } });
  });
});

describe("решение деканата", () => {
  it("засчитать можно от 1 балла до максимума вида", () => {
    expect(checkDecision({ decision: "approved", points: "60", note: "" }, 60)).toEqual({
      ok: true,
      value: { status: "approved", points: 60, note: null },
    });
    for (const points of ["0", "61", "-5", "12.5", "1e2", "", "много"]) {
      expect(checkDecision({ decision: "approved", points, note: "" }, 60).ok, points).toBe(false);
    }
  });

  it("отказ — только с причиной, баллы при отказе не начисляются", () => {
    expect(checkDecision({ decision: "rejected", points: "50", note: "  " }, 60).ok).toBe(false);
    expect(checkDecision({ decision: "rejected", points: "50", note: " Нет подписи оргкомитета " }, 60)).toEqual({
      ok: true,
      value: { status: "rejected", points: null, note: "Нет подписи оргкомитета" },
    });
  });

  it("неизвестное решение не проходит", () => {
    expect(checkDecision({ decision: "pending", points: "10", note: "" }, 60).ok).toBe(false);
  });
});
