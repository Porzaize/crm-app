// ตัวช่วยกลางบันทึก Audit Log (ข้อ 10) — ทุกจุดต้องเรียกผ่านฟังก์ชันนี้ ห้าม create ตรง ๆ
// หมายเหตุ: ไม่ใส่ "server-only" เพราะสคริปต์ import (รันด้วย tsx นอก RSC) ก็ต้องเรียกได้
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CUSTOMER_STATUS_LABELS, ROLE_LABELS } from "./labels";

export type AuditInput = {
  userId?: number | null; // null = ระบบ
  action: string;
  entity: string;
  entityId: number;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

/**
 * บันทึก audit log — เรียก "หลัง" งานหลัก commit แล้ว
 * Trade-off ที่เลือก: ถ้าเขียน log พลาด ให้ log หาย (console.error) ดีกว่าทำงานหลักพัง/rollback
 * เพราะงานหลัก (เปลี่ยนสถานะ/ปรับเงิน) สำคัญกว่าความครบของ log และเกิดนอก transaction หลักอยู่แล้ว
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
      },
    });
  } catch (e) {
    console.error("logAudit failed:", e);
  }
}

// ===== แปลง before/after เป็นข้อความอ่านง่าย (ใช้ทั้งหน้า /admin/audit และหน้าลูกค้า) =====
const FIELD_LABELS: Record<string, string> = {
  status: "สถานะ",
  role: "บทบาท",
  active: "สถานะใช้งาน",
  username: "ชื่อผู้ใช้",
  displayName: "ชื่อแสดง",
  phone: "เบอร์โทร",
  brand: "เว็บ",
  amount: "จำนวนเงิน",
  assignedTo: "มอบหมายให้",
  date: "วันที่",
  archived: "การเก็บ (ซ่อน)",
  count: "จำนวน",
  name: "ชื่อ",
  permissions: "สิทธิ์การเข้าถึง",
};

function fmtVal(key: string, v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (key === "status" && typeof v === "string") return CUSTOMER_STATUS_LABELS[v as never] ?? v;
  if (key === "role" && typeof v === "string") return ROLE_LABELS[v as never] ?? v;
  if (key === "active") return v ? "เปิดใช้งาน" : "ปิดใช้งาน";
  if (key === "archived") return v ? "เก็บ (ซ่อน)" : "ใช้งาน";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** "สถานะ: ขาดฝาก → ห้ามโทร" — แสดงเฉพาะ field ที่มีใน before/after */
export function renderAuditDiff(before: unknown, after: unknown): string {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (keys.length === 0) return "—";
  return keys
    .map((k) => {
      const label = FIELD_LABELS[k] ?? k;
      if (k in b && k in a) return `${label}: ${fmtVal(k, b[k])} → ${fmtVal(k, a[k])}`;
      if (k in a) return `${label}: ${fmtVal(k, a[k])}`;
      return `${label}: ${fmtVal(k, b[k])}`;
    })
    .join(" · ");
}
