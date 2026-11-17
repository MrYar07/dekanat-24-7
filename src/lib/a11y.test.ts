import { describe, expect, it } from "vitest";
import { A11Y_DEFAULT, a11yAttributes, parseA11y, serializeA11y } from "./a11y";

describe("версия для слабовидящих", () => {
  it("настройки переживают cookie туда и обратно", () => {
    const a = { font: "xl", contrast: "wb", spacing: "wide" } as const;
    expect(parseA11y(serializeA11y(a))).toEqual(a);
    expect(parseA11y(serializeA11y(A11Y_DEFAULT))).toEqual(A11Y_DEFAULT);
  });

  it("нет cookie или мусор в размере — обычная версия", () => {
    expect(parseA11y(undefined)).toBeNull();
    expect(parseA11y("")).toBeNull();
    expect(parseA11y("huge.bw.normal")).toBeNull();
  });

  it("мусор в цвете или интервале — значения по умолчанию, а не ошибка", () => {
    expect(parseA11y("md.<script>.x")).toEqual({ font: "md", contrast: "bw", spacing: "normal" });
    expect(parseA11y("lg")).toEqual(A11Y_DEFAULT);
  });

  it("атрибуты для html: обычные цвета и интервал не пишутся", () => {
    expect(a11yAttributes(null)).toEqual({});
    expect(a11yAttributes({ font: "lg", contrast: "normal", spacing: "normal" })).toEqual({ "data-a11y": "", "data-font": "lg" });
    expect(a11yAttributes({ font: "xl", contrast: "blue", spacing: "wide" })).toEqual({
      "data-a11y": "",
      "data-font": "xl",
      "data-contrast": "blue",
      "data-spacing": "wide",
    });
  });
});
