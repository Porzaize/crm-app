import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/constants";
import { resolvePermissions, listHas, type Permission } from "@/lib/permissions";

export { SESSION_COOKIE };
const MAX_AGE = 60 * 60 * 24 * 7; // 7 วัน

/** ข้อมูลพื้นฐานที่ฝังใน JWT (ไม่รวมสิทธิ์ — สิทธิ์ resolve สดจาก DB ทุก request) */
export type SessionUser = {
  userId: number;
  username: string;
  displayName: string;
  role: Role;
};

export type Session = SessionUser & {
  /** สิทธิ์ที่มีผลจริง resolve แล้ว ("*" = ทุกสิทธิ์) */
  permissions: readonly Permission[] | "*";
};

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET ไม่ได้ตั้งค่าใน .env");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(session: SessionUser, tokenVersion = 0): Promise<string> {
  return await new SignJWT({
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    role: session.role,
    tv: tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

/** โทเค็นชั่วคราว (5 นาที) ออกหลังยืนยันรหัสผ่านถูก แต่ยังต้องกรอกรหัส 2FA */
export async function signPending2FA(userId: number): Promise<string> {
  return await new SignJWT({ p2fa: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret());
}

/** ตรวจโทเค็นชั่วคราว 2FA — คืน userId ถ้าใช้ได้ */
export async function verifyPending2FA(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.p2fa === "number" ? payload.p2fa : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: SessionUser, tokenVersion = 0) {
  const token = await createSessionToken(session, tokenVersion);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * อ่าน session — ครอบด้วย React cache() เพื่อ dedupe การ query DB ภายใน request เดียว
 * (layout + page + ปุ่ม UI เรียกซ้ำได้โดยไม่ยิง DB หลายรอบ → ลดความหน่วง)
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.userId as number;
    const tv = (payload.tv as number) ?? 0;

    // ตรวจสด: บัญชีต้องยัง active และ tokenVersion ต้องตรง (รองรับ revoke/ปิดบัญชี/เปลี่ยนรหัสทันที)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, displayName: true, role: true, active: true, tokenVersion: true,
        customPermissions: true, permissions: true,
      },
    });
    if (!user || !user.active || user.tokenVersion !== tv) return null;

    // คืนข้อมูลสดจาก DB (ชื่อ/บทบาท/สิทธิ์เปลี่ยนมีผลทันที)
    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions: resolvePermissions(user.role, user.customPermissions, user.permissions),
    };
  } catch {
    return null;
  }
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** ตรวจสิทธิ์จาก session ที่มีอยู่แล้ว (ใช้ gate ปุ่ม/ส่วนของหน้า หรือใน action ที่คืน error เอง) */
export function can(session: Session, perm: Permission): boolean {
  return listHas(session.permissions, perm);
}

/** บังคับสิทธิ์ — ไม่มีสิทธิ์ให้ redirect กลับหน้าแรก (ใช้หัวหน้าหน้า/บนสุดของ action) */
export async function requirePermission(perm: Permission): Promise<Session> {
  const session = await requireSession();
  if (!listHas(session.permissions, perm)) redirect("/");
  return session;
}
