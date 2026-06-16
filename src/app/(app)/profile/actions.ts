"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireSession, setSessionCookie } from "@/lib/auth";
import { generateSecret, verifyTotp, otpauthURL } from "@/lib/totp";
import { logAudit } from "@/lib/audit";

export type ChangePasswordState = { error?: string; ok?: string };

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  // userId อ่านจาก session เท่านั้น — ห้ามรับจาก form (ผู้ใช้แก้ HTML ได้)
  const session = await requireSession();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next) return { error: "กรุณากรอกข้อมูลให้ครบ" };
  if (next.length < 6) return { error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัว" };
  if (next !== confirm) return { error: "รหัสผ่านใหม่และช่องยืนยันไม่ตรงกัน" };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: "ไม่พบผู้ใช้" };

  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) return { error: "รหัสผ่านเดิมไม่ถูกต้อง" };

  if (await bcrypt.compare(next, user.passwordHash)) {
    return { error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" };
  }

  const passwordHash = await bcrypt.hash(next, 10);
  // bump tokenVersion = เตะทุก session เดิมออก (ความปลอดภัย) แล้วออก cookie ใหม่ให้เครื่องนี้
  const newTv = user.tokenVersion + 1;
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: newTv } });
  await setSessionCookie(
    { userId: user.id, username: user.username, displayName: user.displayName, role: user.role },
    newTv
  );

  return { ok: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว — อุปกรณ์อื่นถูกออกจากระบบทั้งหมด" };
}

// ===== ยืนยันตัวตน 2 ชั้น (2FA / TOTP) — opt-in รายคน =====

export type TwoFactorState = {
  error?: string;
  setup?: boolean; // กำลังตั้งค่า → แสดง QR
  secret?: string;
  qr?: string; // data URL ของ QR
  done?: "enabled" | "disabled";
};

export async function twoFactorAction(
  _prev: TwoFactorState,
  formData: FormData
): Promise<TwoFactorState> {
  const session = await requireSession();
  const action = String(formData.get("action") ?? "");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: "ไม่พบผู้ใช้" };

  // เริ่มตั้งค่า — สุ่ม secret ใหม่ (เก็บไว้แต่ยังไม่เปิดใช้) แล้วสร้าง QR
  if (action === "start") {
    const secret = generateSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });
    const qr = await QRCode.toDataURL(otpauthURL(secret, user.username));
    return { setup: true, secret, qr };
  }

  // ยืนยันเปิดใช้ — ตรวจรหัสจากแอปกับ secret ที่เพิ่งตั้ง
  if (action === "enable") {
    const code = String(formData.get("code") ?? "");
    if (!user.twoFactorSecret) return { error: "ยังไม่ได้เริ่มตั้งค่า กรุณากด “เปิดใช้ 2FA” ใหม่" };
    if (!verifyTotp(user.twoFactorSecret, code)) {
      const qr = await QRCode.toDataURL(otpauthURL(user.twoFactorSecret, user.username));
      return { setup: true, secret: user.twoFactorSecret, qr, error: "รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง" };
    }
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    await logAudit({ userId: user.id, action: "user.2fa_enabled", entity: "User", entityId: user.id });
    return { done: "enabled" };
  }

  // ปิด — ต้องกรอกรหัสปัจจุบันเพื่อยืนยันว่าถือเครื่องอยู่จริง
  if (action === "disable") {
    const code = String(formData.get("code") ?? "");
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return { error: "2FA ยังไม่ได้เปิดใช้" };
    if (!verifyTotp(user.twoFactorSecret, code)) {
      return { error: "รหัสไม่ถูกต้อง — ต้องกรอกรหัสปัจจุบันจากแอปเพื่อปิด" };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await logAudit({ userId: user.id, action: "user.2fa_disabled", entity: "User", entityId: user.id });
    return { done: "disabled" };
  }

  return { error: "คำสั่งไม่ถูกต้อง" };
}
