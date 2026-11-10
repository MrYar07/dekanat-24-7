import "server-only";
import { headers } from "next/headers";

/**
 * Адрес сайта для ссылок наружу (QR-код справки).
 *
 * В проде он задан явно: SITE_URL собирается в compose.yaml из SITE_ADDRESS, того же адреса,
 * на который Caddy получает сертификат. По заголовкам запроса его не угадываем: за прокси туда
 * может попасть внутренний адрес, а подменённый Host попал бы в QR-код справки.
 * Без SITE_URL (локальная разработка) берём хост из запроса.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
}

export async function verifyUrl(code: string): Promise<string> {
  return `${await siteOrigin()}/verify/${code}`;
}
