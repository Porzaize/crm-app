import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// ตรวจแค่ว่ามี cookie session ไหม (verify จริงทำในหน้า/แอ็กชัน)
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const { pathname } = req.nextUrl;

  // /api/cron/* ป้องกันด้วย Bearer CRON_SECRET เอง (เรียกจาก scheduler ไม่มี cookie) — ปล่อยผ่าน
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  if (!hasSession && pathname !== "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // ยกเว้น static / image / api ภายในของ next และ logout
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logout).*)"],
};
