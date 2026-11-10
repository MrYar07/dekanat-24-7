import "server-only";
import { headers } from "next/headers";

/**
 * Адрес сайта для ссылок наружу (QR-код справки). В проде запрос приходит через Caddy,
 * он передаёт исходный хост и протокол; локально это localhost:3000.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function verifyUrl(code: string): Promise<string> {
  return `${await siteOrigin()}/verify/${code}`;
}
