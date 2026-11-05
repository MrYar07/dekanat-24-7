import { hash, verify } from "@node-rs/argon2";

// Параметры argon2id по рекомендациям OWASP: 19 МиБ памяти, 2 прохода.
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Хеш несуществующего пароля: сравниваем с ним, когда логина нет,
// чтобы по времени ответа нельзя было понять, существует ли аккаунт.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  return dummyHash;
}
