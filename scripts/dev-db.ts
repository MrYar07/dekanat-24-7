// Локальный PostgreSQL для разработки без Docker.
// Данные лежат на системном диске: PostgreSQL не работает надёжно на exFAT.
import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import EmbeddedPostgres from "embedded-postgres";

const url = new URL(process.env.DATABASE_URL ?? "");
const dataDir =
  process.env.DEV_PG_DIR ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "dekanat-24-7", "pgdata");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port),
  persistent: true,
  // Без явной кодировки initdb на русской Windows создаёт кластер в WIN1251,
  // и символы вроде «→» не сохраняются. На сервере база в UTF-8 — локально так же.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function main() {
  const fresh = !existsSync(join(dataDir, "PG_VERSION"));
  if (fresh) await pg.initialise();
  await pg.start();
  const dbName = url.pathname.slice(1);
  if (fresh) await pg.createDatabase(dbName);
  console.log(`PostgreSQL запущен: порт ${url.port}, база ${dbName}, данные в ${dataDir}`);
  console.log("Остановить: Ctrl+C");
}

async function shutdown() {
  await pg.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (err) => {
  console.error(err);
  await pg.stop().catch(() => {});
  process.exit(1);
});
