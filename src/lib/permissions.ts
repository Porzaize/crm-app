// ===== ระบบสิทธิ์แบบ permission matrix (ข้อ Tier 5) =====
// ไฟล์นี้ "pure" (ไม่ import server-only) เพื่อให้ทั้งฝั่ง server (auth.ts) และ client (Sidebar/ฟอร์มสิทธิ์) ใช้ร่วมกันได้
// โมเดล: บทบาท = ค่าตั้งต้น (preset) + ติ๊กปรับรายคนได้ (override) — ดู resolvePermissions()
import type { Role } from "@prisma/client";

/** รายการสิทธิ์ทั้งหมดในระบบ — ใช้เป็น single source of truth ของ capability */
export const PERMISSIONS = [
  "customer.view",        // ดูรายชื่อ/รายละเอียดลูกค้า
  "customer.manage",      // แก้ไข/มอบหมาย/บันทึกฝาก-โบนัส/เก็บ-กู้คืนลูกค้า
  "customer.status",      // เปลี่ยนสถานะลูกค้า (รวมตั้งห้ามโทร)
  "customer.export",      // ส่งออกรายชื่อลูกค้า (CSV/Excel)
  "queue.call",           // บันทึกผลสายของงานที่ได้รับมอบหมาย
  "queue.call_any",       // บันทึกผลสายของรายการใดก็ได้ (ไม่จำกัดเฉพาะของตัวเอง)
  "queue.assign",         // มอบหมายงานโทร / มอบหมายเป็นชุด
  "report.view",          // ดูรายงาน + ส่งออกรายงาน
  "import.run",           // นำเข้าไฟล์ + ดูประวัติการนำเข้า
  "campaign.manage",      // จัดการแคมเปญ
  "sms.manage",           // จัดการคลังข้อความ SMS
  "notification.manage",  // ตั้งค่าแจ้งเตือน Telegram
  "user.manage",          // จัดการผู้ใช้/บทบาท
  "brand.manage",         // จัดการเว็บ/แบรนด์
  "audit.view",           // ดู Audit Log
  "activity.view",        // ดูหน้าตรวจสอบ/ทุจริต
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** ป้ายไทย + คำอธิบายของแต่ละสิทธิ์ (ใช้ในฟอร์มติ๊กสิทธิ์) */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "customer.view": "ดูข้อมูลลูกค้า",
  "customer.manage": "แก้ไข/มอบหมาย/บันทึกฝาก-โบนัส/เก็บลูกค้า",
  "customer.status": "เปลี่ยนสถานะลูกค้า (รวมห้ามโทร)",
  "customer.export": "ส่งออกรายชื่อลูกค้า (CSV/Excel)",
  "queue.call": "บันทึกผลสาย (เฉพาะงานที่ได้รับมอบหมาย)",
  "queue.call_any": "บันทึกผลสาย (ทุกรายการ)",
  "queue.assign": "มอบหมายงานโทร / มอบหมายเป็นชุด",
  "report.view": "ดูรายงาน + ส่งออกรายงาน",
  "import.run": "นำเข้าไฟล์ + ดูประวัติการนำเข้า",
  "campaign.manage": "จัดการแคมเปญ",
  "sms.manage": "จัดการคลังข้อความ SMS",
  "notification.manage": "ตั้งค่าแจ้งเตือน Telegram",
  "user.manage": "จัดการผู้ใช้ / บทบาท",
  "brand.manage": "จัดการเว็บ / แบรนด์",
  "audit.view": "ดู Audit Log",
  "activity.view": "ดูหน้าตรวจสอบ / ทุจริต",
};

/** จัดกลุ่มสิทธิ์เพื่อแสดงในฟอร์ม */
export const PERMISSION_GROUPS: { title: string; perms: Permission[] }[] = [
  { title: "ลูกค้า", perms: ["customer.view", "customer.manage", "customer.status", "customer.export"] },
  { title: "คิวโทร", perms: ["queue.call", "queue.call_any", "queue.assign"] },
  { title: "รายงาน", perms: ["report.view"] },
  { title: "เครื่องมือ", perms: ["import.run", "campaign.manage", "sms.manage", "notification.manage"] },
  { title: "ผู้ดูแลระบบ", perms: ["user.manage", "brand.manage", "audit.view", "activity.view"] },
];

/** "*" = ทุกสิทธิ์ (superuser) */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[] | "*"> = {
  ADMIN: "*",
  SUPERVISOR: [
    "customer.view",
    "customer.manage",
    "customer.status",
    "customer.export",
    "queue.call",
    "queue.call_any",
    "queue.assign",
    "report.view",
    "import.run",
    "campaign.manage",
    "sms.manage",
    // หมายเหตุ: ตั้งค่าแจ้งเตือน Telegram (notification.manage) = สงวนไว้ให้ผู้ดูแลระบบ
  ],
  AGENT: ["customer.view", "queue.call"],
};

/** ป้ายไทยของบทบาท (ใช้ในฟอร์ม) */
export const ROLE_LABELS_TH: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  SUPERVISOR: "หัวหน้าทีม",
  AGENT: "พนักงาน",
};

/** กางสิทธิ์ตั้งต้นของบทบาทเป็นรายการเต็ม ("*" → ทุกสิทธิ์) */
export function presetFor(role: Role): Permission[] {
  const p = ROLE_PERMISSIONS[role];
  return p === "*" ? [...PERMISSIONS] : [...p];
}

/** สิทธิ์ที่มีผลจริงของผู้ใช้ — ADMIN = ทุกสิทธิ์เสมอ, มี override = ใช้รายการที่ติ๊ก, ไม่งั้นใช้ค่าตั้งต้นของบทบาท */
export function resolvePermissions(
  role: Role,
  customPermissions: boolean,
  permissions: readonly string[]
): readonly Permission[] | "*" {
  if (role === "ADMIN") return "*";
  if (customPermissions) {
    return PERMISSIONS.filter((p) => permissions.includes(p));
  }
  return ROLE_PERMISSIONS[role];
}

/** รายการสิทธิ์ที่ resolve แล้วมีสิทธิ์ที่ระบุหรือไม่ */
export function listHas(perms: readonly Permission[] | "*", perm: Permission): boolean {
  return perms === "*" || perms.includes(perm);
}

/** บทบาทนี้ (ค่าตั้งต้น) มีสิทธิ์ที่ระบุหรือไม่ (pure — ใช้ได้ทั้ง server/client) */
export function roleHas(role: Role, perm: Permission): boolean {
  const p = ROLE_PERMISSIONS[role];
  return p === "*" || p.includes(perm);
}

/**
 * แปลงรายการสิทธิ์ที่ผู้ใช้ติ๊ก (จากฟอร์ม) เป็นค่าที่จะเก็บลง DB
 * - กรองเฉพาะ key ที่ถูกต้อง
 * - ถ้าชุดที่ติ๊ก "ตรงกับ" ค่าตั้งต้นของบทบาทเป๊ะ → ถือว่าสืบทอดบทบาท (customPermissions=false)
 *   เพื่อให้การปรับ preset บทบาทในอนาคตมีผลกับผู้ใช้กลุ่มนี้ด้วย
 */
export function normalizePermissionInput(
  role: Role,
  selected: readonly string[]
): { customPermissions: boolean; permissions: Permission[] } {
  // ADMIN ได้ทุกสิทธิ์เสมอ — ไม่เก็บ override
  if (role === "ADMIN") return { customPermissions: false, permissions: [] };

  const valid = PERMISSIONS.filter((p) => selected.includes(p));
  const preset = presetFor(role);
  const sameAsPreset =
    valid.length === preset.length && valid.every((p) => preset.includes(p));

  if (sameAsPreset) return { customPermissions: false, permissions: [] };
  return { customPermissions: true, permissions: valid };
}
