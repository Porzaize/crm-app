"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSessionCookie, signPending2FA, verifyPending2FA } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { logAudit } from "@/lib/audit";

export type LoginState = { error?: string; step?: "totp"; pending?: string };

const LOCK_THRESHOLD = 5; // กรอกผิดติดกันกี่ครั้งจึงล็อก
const LOCK_MINUTES = 15; // ล็อกนานกี่นาที

type UserRow = { id: number; username: string; displayName: string; role: "ADMIN" | "SUPERVISOR" | "AGENT"; tokenVersion: number };

async function issueSession(user: UserRow) {
  await setSessionCookie(
    { userId: user.id, username: user.username, displayName: user.displayName, role: user.role },
    user.tokenVersion
  );
}

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  // ===== ขั้น 2: ยืนยันรหัส 2FA (หลังรหัสผ่านถูกแล้ว) =====
  if (formData.get("step") === "totp") {
    const pending = String(formData.get("pending") ?? "");
    const code = String(formData.get("code") ?? "");
    const userId = await verifyPending2FA(pending);
    if (!userId) return { error: "หมดเวลายืนยันตัวตน กรุณาเข้าสู่ระบบใหม่" };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return { error: "ไม่สามารถยืนยันได้ กรุณาเข้าสู่ระบบใหม่" };
    }
    if (!verifyTotp(user.twoFactorSecret, code)) {
      await logAudit({ userId: user.id, action: "user.login_2fa_failed", entity: "User", entityId: user.id });
      return { step: "totp", pending, error: "รหัสยืนยันไม่ถูกต้อง" };
    }
    await issueSession(user);
    await logAudit({ userId: user.id, action: "user.login", entity: "User", entityId: user.id, after: { twofa: true } });
    redirect("/");
  }

  // ===== ขั้น 1: ชื่อผู้ใช้ + รหัสผ่าน =====
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    await logAudit({ userId: user?.id ?? null, action: "user.login_failed", entity: "User", entityId: user?.id ?? 0, after: { username } });
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

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

  // รหัสผ่านถูก — ล้างตัวนับ/ล็อก
  if (user.failedLoginCount !== 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  // ถ้าเปิด 2FA → ยังไม่ออก session ขอรหัสจากแอปอีกขั้น
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const pending = await signPending2FA(user.id);
    return { step: "totp", pending };
  }

  await issueSession(user);
  await logAudit({ userId: user.id, action: "user.login", entity: "User", entityId: user.id });
  redirect("/");
}
