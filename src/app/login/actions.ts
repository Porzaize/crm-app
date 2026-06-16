"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type LoginState = { error?: string };

const LOCK_THRESHOLD = 5; // กรอกผิดติดกันกี่ครั้งจึงล็อก
const LOCK_MINUTES = 15; // ล็อกนานกี่นาที

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    // บันทึกความพยายามล็อกอินที่ล้มเหลว (เฝ้าระวังการเดารหัส) — ไม่เก็บรหัสผ่าน
    await logAudit({ userId: user?.id ?? null, action: "user.login_failed", entity: "User", entityId: user?.id ?? 0, after: { username } });
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  // บัญชีถูกล็อกอยู่?
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logAudit({ userId: user.id, action: "user.login_failed", entity: "User", entityId: user.id, after: { username, locked: true } });
    return { error: `บัญชีถูกล็อกชั่วคราวจากการกรอกรหัสผิดหลายครั้ง กรุณาลองใหม่ภายหลังหรือติดต่อผู้ดูแล` };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const count = user.failedLoginCount + 1;
    const shouldLock = count >= LOCK_THRESHOLD;
    await prisma.user.update({
      where: { id: user.id },
      data: shouldLock
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) }
        : { failedLoginCount: count },
    });
    await logAudit({ userId: user.id, action: "user.login_failed", entity: "User", entityId: user.id, after: { username, attempt: count, locked: shouldLock } });
    return {
      error: shouldLock
        ? `กรอกรหัสผ่านผิดเกิน ${LOCK_THRESHOLD} ครั้ง บัญชีถูกล็อก ${LOCK_MINUTES} นาที`
        : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    };
  }

  // สำเร็จ — ล้างตัวนับ/ล็อก แล้วออก session พร้อม tokenVersion ปัจจุบัน
  if (user.failedLoginCount !== 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  await setSessionCookie(
    { userId: user.id, username: user.username, displayName: user.displayName, role: user.role },
    user.tokenVersion
  );

  await logAudit({ userId: user.id, action: "user.login", entity: "User", entityId: user.id });

  redirect("/");
}
