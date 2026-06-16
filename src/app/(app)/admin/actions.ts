"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { normalizePermissionInput, presetFor, PERMISSION_LABELS, type Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export type CreateUserState = { error?: string; ok?: string };

const ROLES: Role[] = ["ADMIN", "SUPERVISOR", "AGENT"];

/** อธิบายสิทธิ์เป็นข้อความสำหรับ audit log */
function describePerms(role: Role, customPermissions: boolean, permissions: Permission[]): string {
  if (!customPermissions) return `ตามบทบาท (${role})`;
  if (permissions.length === 0) return "ไม่มีสิทธิ์";
  return permissions.map((p) => PERMISSION_LABELS[p]).join(", ");
}

export async function createUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const admin = await requirePermission("user.manage");

  const username = String(formData.get("username") ?? "").trim();
  // ชื่อแสดง: ถ้าไม่กรอก ใช้ username แทน (ฟอร์มลงทะเบียนแบบสั้นไม่มีช่องชื่อแสดง)
  const displayName = String(formData.get("displayName") ?? "").trim() || username;
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!role || !ROLES.includes(role)) return { error: "กรุณาเลือกบทบาท" };
  if (!username) return { error: "กรุณากรอกชื่อผู้ใช้" };
  if (password.length < 6) return { error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัว" };
  if (confirmPassword && password !== confirmPassword) return { error: "รหัสผ่านยืนยันไม่ตรงกัน" };

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return { error: "มีชื่อผู้ใช้นี้อยู่แล้ว" };

  // สิทธิ์ที่ติ๊ก — ถ้าตรง preset ของบทบาท = สืบทอด (customPermissions=false)
  const selected = formData.getAll("permissions").map(String);
  const { customPermissions, permissions } = normalizePermissionInput(role, selected);

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { username, displayName, role, passwordHash, customPermissions, permissions },
  });

  // audit: ไม่เก็บรหัสผ่าน/hash
  await logAudit({
    userId: admin.userId,
    action: "user.create",
    entity: "User",
    entityId: created.id,
    after: { username, displayName, role, permissions: describePerms(role, customPermissions, permissions) },
  });

  revalidatePath("/admin");
  return { ok: `สร้างผู้ใช้ ${username} แล้ว` };
}

export async function updateUser(formData: FormData) {
  const admin = await requirePermission("user.manage");
  const userId = Number(formData.get("userId"));
  const displayName = String(formData.get("displayName") ?? "").trim();
  let role = String(formData.get("role") ?? "") as Role;
  if (!userId || !displayName || !ROLES.includes(role)) return;

  const prev = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, role: true },
  });
  if (!prev) return;

  // กันแอดมินลดบทบาทตัวเอง (ล็อกตัวเองออกจากระบบจัดการ)
  if (userId === admin.userId && role !== "ADMIN") role = "ADMIN";
  if (prev.displayName === displayName && prev.role === role) return;

  // เปลี่ยนบทบาท = คืนสิทธิ์ให้เป็นค่าตั้งต้นของบทบาทใหม่ (ล้าง override เดิม) เพื่อไม่ให้สิทธิ์เก่าค้าง
  const roleChanged = prev.role !== role;
  await prisma.user.update({
    where: { id: userId },
    data: roleChanged
      ? { displayName, role, customPermissions: false, permissions: [] }
      : { displayName, role },
  });
  await logAudit({
    userId: admin.userId,
    action: "user.update",
    entity: "User",
    entityId: userId,
    before: { displayName: prev.displayName, role: prev.role },
    after: { displayName, role },
  });
  revalidatePath("/admin");
}

export async function resetPassword(formData: FormData) {
  const admin = await requirePermission("user.manage");
  const userId = Number(formData.get("userId"));
  const password = String(formData.get("password") ?? "");
  if (!userId || password.length < 6) return;
  const passwordHash = await bcrypt.hash(password, 10);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  // รีเซ็ตรหัส = เตะ session เดิมออก (bump tokenVersion) + ปลดล็อกบัญชี
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: (target?.tokenVersion ?? 0) + 1, failedLoginCount: 0, lockedUntil: null },
  });
  // audit: บันทึกแค่ว่ามีการรีเซ็ต — ห้ามเก็บรหัส/hash
  await logAudit({ userId: admin.userId, action: "user.reset_password", entity: "User", entityId: userId });
  revalidatePath("/admin");
}

/** ปลดล็อกบัญชีที่ถูกล็อกจากการกรอกรหัสผิด */
export async function unlockUser(formData: FormData) {
  const admin = await requirePermission("user.manage");
  const userId = Number(formData.get("userId"));
  if (!userId) return;
  await prisma.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } });
  await logAudit({ userId: admin.userId, action: "user.unlock", entity: "User", entityId: userId });
  revalidatePath("/admin");
}

/** ปรับสิทธิ์รายคนของผู้ใช้ที่มีอยู่ (จากตารางจัดการผู้ใช้) */
export async function setUserPermissions(formData: FormData) {
  const admin = await requirePermission("user.manage");
  const userId = Number(formData.get("userId"));
  if (!userId) return;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, customPermissions: true, permissions: true },
  });
  if (!target) return;
  // ผู้ดูแลระบบเข้าถึงทุกฟังก์ชันเสมอ — ไม่ปรับสิทธิ์
  if (target.role === "ADMIN") return;

  const selected = formData.getAll("permissions").map(String);
  const { customPermissions, permissions } = normalizePermissionInput(target.role, selected);

  // เทียบสิทธิ์ที่มีผลจริง (เก่า vs ใหม่) — เท่ากันก็ไม่ต้องเขียน
  const effective = (custom: boolean, perms: readonly string[]) =>
    custom ? [...perms].sort() : presetFor(target.role).sort();
  const prevEff = effective(target.customPermissions, target.permissions);
  const nextEff = effective(customPermissions, permissions);
  if (prevEff.length === nextEff.length && prevEff.every((p, i) => p === nextEff[i])) return;

  await prisma.user.update({ where: { id: userId }, data: { customPermissions, permissions } });
  await logAudit({
    userId: admin.userId,
    action: "user.permissions_change",
    entity: "User",
    entityId: userId,
    before: { permissions: describePerms(target.role, target.customPermissions, target.permissions as Permission[]) },
    after: { permissions: describePerms(target.role, customPermissions, permissions) },
  });
  revalidatePath("/admin");
}

export async function setActive(formData: FormData) {
  const admin = await requirePermission("user.manage");
  const userId = Number(formData.get("userId"));
  const active = formData.get("active") === "true";
  if (!userId) return;
  const prev = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  await prisma.user.update({ where: { id: userId }, data: { active } });
  await logAudit({
    userId: admin.userId,
    action: "user.set_active",
    entity: "User",
    entityId: userId,
    before: prev ? { active: prev.active } : undefined,
    after: { active },
  });
  revalidatePath("/admin");
}
