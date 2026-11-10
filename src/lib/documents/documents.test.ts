import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { isVerificationCode, maskName, newVerificationCode } from ".";
import { documentNumber, renderDocument, runs, wrap } from "./pdf";
import type { StudentSnapshot } from "./types";

const student: StudentSnapshot = {
  lastName: "Смирнова",
  firstName: "Алина",
  middleName: "Викторовна",
  recordBookNumber: "24-0117",
  faculty: "Факультет глобальной экономики",
  programCode: "38.03.01",
  program: "Мировая экономика и торговля",
  group: "ГЭ-24-1",
  course: 2,
  isPaid: true,
};
const info = { number: "С-000012", issuedAt: new Date("2026-11-10T09:00:00Z"), code: "AbCdEfGhIjKlMnOpQrStUv", verifyUrl: "https://example.test/verify/AbCdEfGhIjKlMnOpQrStUv" };

describe("код проверки", () => {
  it("22 символа base64url и каждый раз новый", () => {
    const a = newVerificationCode();
    expect(isVerificationCode(a)).toBe(true);
    expect(newVerificationCode()).not.toBe(a);
  });
  it("мусор из адреса отбрасывается", () => {
    expect(isVerificationCode("../../etc/passwd")).toBe(false);
    expect(isVerificationCode("short")).toBe(false);
  });
});

describe("маскирование ФИО", () => {
  it("фамилия и инициалы", () => expect(maskName("Смирнова", "Алина", "Викторовна")).toBe("Смирнова А. В."));
  it("без отчества", () => expect(maskName("Ким", "Ён", null)).toBe("Ким Ё."));
});

describe("PDF", () => {
  it("кириллица и латиница идут разными кусками", () => {
    expect(runs("№ 12, ГЭ-24")).toEqual([
      { cyr: true, text: "№" },
      { cyr: false, text: " 12, " },
      { cyr: true, text: "ГЭ" },
      { cyr: false, text: "-24" },
    ]);
  });

  it("перенос по словам", () => {
    expect(wrap("раз два три четыре", 9, (s) => s.length)).toEqual(["раз два", "три", "четыре"]);
  });

  it("номер документа", () => {
    expect(documentNumber("study", 12)).toBe("С-000012");
    expect(documentNumber("rating", 7)).toBe("Р-000007");
  });

  it("справка об обучении — одностраничный PDF", async () => {
    const bytes = await renderDocument({ kind: "study", student, purpose: "по месту работы родителей" }, info);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("СПРАВКА ОБ ОБУЧЕНИИ № С-000012");
  });

  it("выписка рейтинга — одностраничный PDF", async () => {
    const bytes = await renderDocument(
      {
        kind: "rating",
        student,
        term: "1-й триместр 2026/27 учебного года",
        rows: [
          { discipline: "Макроэкономика", assessment: "exam", score: 91.5, mark: "отлично" },
          { discipline: "Международные финансы", assessment: "exam", score: 85.1, mark: "хорошо" },
        ],
        rating: 91,
        base: 89.4,
        bonus: 1.6,
        forecast: true,
      },
      { ...info, number: "Р-000013" },
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
