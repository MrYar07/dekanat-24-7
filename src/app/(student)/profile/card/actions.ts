"use server";

import QRCode from "qrcode";
import { issueMyCardToken } from "@/lib/data/card";
import { cardVerifyUrl } from "@/lib/site";

export type CardCode = { url: string; svg: string; expiresAt: number };

/** QR-код студенческого: новый одноразовый код и его картинка. Студент — из сессии. */
export async function newCardCode(): Promise<CardCode | null> {
  const issued = await issueMyCardToken();
  if (!issued) return null;
  const url = await cardVerifyUrl(issued.token);
  // Чёрный по белому при любой теме: так QR читают все сканеры.
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return { url, svg, expiresAt: issued.expiresAt.getTime() };
}
