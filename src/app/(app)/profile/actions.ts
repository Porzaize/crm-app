"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSession, setSessionCookie } from "@/lib/auth";

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
