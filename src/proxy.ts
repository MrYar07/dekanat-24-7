import { NextResponse, type NextRequest } from "next/server";

// Быстрая проверка до рендера: без cookie сессии сразу на вход.
// Это только удобство. Настоящая проверка сессии и прав — на сервере, в lib/auth/dal.ts.
const SESSION_COOKIE = "d247_session";
const PUBLIC_PATHS = ["/login", "/verify"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
