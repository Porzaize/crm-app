import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

export async function GET(req: NextRequest) {
  // ใน Route Handler ต้องลบ cookie บน response object ที่ส่งกลับ
  // (การเรียก cookies().delete() แล้ว redirect ไม่ติด Set-Cookie ใน Next 16)
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
