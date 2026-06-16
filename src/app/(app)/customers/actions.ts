"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, requirePermission, can } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notify, escapeHtml, getSetting, SETTING_KEYS } from "@/lib/telegram";
import { maskPhone, formatMoney } from "@/lib/labels";
import { dateOnlyUTC, bangkokYMD } from "@/lib/dates";
import { getDefaultCampaignId } from "@/lib/campaigns";
import type { CustomerStatus } from "@prisma/client";

export type StatusState = { error?: string; ok?: string };

const VALID: CustomerStatus[] = ["ACTIVE", "LAPSED", "DO_NOT_CALL"];

/** เบอร์ -> 10 หลัก (เติม 0 หน้า) ; null ถ้าไม่ใช่เบอร์ที่ใช้ได้ */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const p = digits.length === 9 ? "0" + digits : digits;
  if (p.length !== 10) return null;
  return p;
}

/** "YYYY-MM-DD" (วันไทย) -> Date date-only UTC midnight ; default วันนี้ (เวลาไทย) */
function parseDateOnly(raw: string): Date {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return dateOnlyUTC(+m[1], +m[2], +m[3]);
  const [y, mo, d] = bangkokYMD().split("-").map(Number);
  return dateOnlyUTC(y, mo, d);
}

export async function updateCustomerStatus(
  _prev: StatusState,
  formData: FormData
): Promise<StatusState> {
  const session = await requireSession();
  if (!can(session, "customer.status")) {
    return { error: "เฉพาะหัวหน้าทีมขึ้นไปเท่านั้นที่เปลี่ยนสถานะได้" };
  }

  const customerId = Number(formData.get("customerId"));
  const status = String(formData.get("status") ?? "") as CustomerStatus;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!customerId || !VALID.includes(status)) return { error: "ข้อมูลไม่ถูกต้อง" };
  if (status === "DO_NOT_CALL" && !reason) {
    return { error: "กรุณาระบุเหตุผลเมื่อตั้งสถานะห้ามโทร" };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { brand: true },
  });
  if (!customer) return { error: "ไม่พบลูกค้า" };
  if (customer.status === status) return { ok: "สถานะไม่เปลี่ยนแปลง" };

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: customerId }, data: { status } });
    // ตั้งห้ามโทร -> ปิดงานที่ยังค้างในคิวของลูกค้ารายนี้
    if (status === "DO_NOT_CALL") {
      await tx.campaignContact.updateMany({
        where: { customerId, status: "PENDING" },
        data: { status: "DONE", nextCallAt: null },
      });
    }
    // บันทึกประวัติการเปลี่ยนสถานะ (ใคร/จาก/เป็น/เหตุผล)
    await tx.statusChangeLog.create({
      data: {
        customerId,
        fromStatus: customer.status,
        toStatus: status,
        changedById: session.userId,
        reason: reason || null,
      },
    });
  });

  // audit (ข้อ 10) — นอก transaction: log หายดีกว่างานหลักพัง
  await logAudit({
    userId: session.userId,
    action: "customer.status_change",
    entity: "Customer",
    entityId: customerId,
    before: { status: customer.status },
    after: { status },
  });

  // แจ้งเตือน Telegram กลุ่มหัวหน้า เมื่อตั้งห้ามโทร (เช็ค enabled ภายใน notify; ล่ม/ปิด = เงียบ ไม่กระทบงาน)
  if (status === "DO_NOT_CALL") {
    await notify(
      "dnc",
      `🚫 <b>ตั้งห้ามโทร (DNC)</b>\n` +
        `เว็บ: ${escapeHtml(customer.brand.name)}\n` +
        `เบอร์: ${maskPhone(customer.phone)}\n` +
        `โดย: ${escapeHtml(session.displayName)}\n` +
        `เหตุผล: ${escapeHtml(reason || "-")}`
    );
  }

  revalidatePath(`/customers/${customerId}`);
  return { ok: "บันทึกสถานะแล้ว" };
}

// ===== เพิ่มลูกค้าใหม่ (manual) =====
export async function createCustomer(_prev: StatusState, formData: FormData): Promise<StatusState> {
  const session = await requirePermission("customer.manage");

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const brandId = Number(formData.get("brandId"));
  const status = String(formData.get("status") ?? "LAPSED") as CustomerStatus;
  const assignedToId = Number(formData.get("assignedToId")) || null;

  if (!phone) return { error: "เบอร์โทรไม่ถูกต้อง (ต้องเป็นเลข 10 หลัก)" };
  if (!brandId) return { error: "กรุณาเลือกเว็บ" };
  if (!VALID.includes(status)) return { error: "สถานะไม่ถูกต้อง" };

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return { error: "ไม่พบเว็บที่เลือก" };

  const dup = await prisma.customer.findUnique({ where: { brandId_phone: { brandId, phone } } });
  if (dup) return { error: `มีลูกค้าเบอร์นี้ในเว็บ ${brand.name} อยู่แล้ว` };

  const customer = await prisma.customer.create({ data: { phone, brandId, status } });

  // ถ้าเลือกมอบหมาย + ไม่ใช่ห้ามโทร → สร้างงานในคิว
  if (assignedToId && status !== "DO_NOT_CALL") {
    const campaignId = await getDefaultCampaignId();
    await prisma.campaignContact.create({
      data: { campaignId, customerId: customer.id, assignedToId, status: "PENDING" },
    });
  }

  await logAudit({
    userId: session.userId,
    action: "customer.create",
    entity: "Customer",
    entityId: customer.id,
    after: { phone, brand: brand.name, status },
  });

  redirect(`/customers/${customer.id}`);
}

// ===== แก้ไขข้อมูลลูกค้า (เบอร์ + เว็บ) =====
export async function updateCustomer(_prev: StatusState, formData: FormData): Promise<StatusState> {
  const session = await requirePermission("customer.manage");

  const customerId = Number(formData.get("customerId"));
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const brandId = Number(formData.get("brandId"));
  if (!customerId || !phone || !brandId) return { error: "ข้อมูลไม่ครบหรือไม่ถูกต้อง" };

  const cur = await prisma.customer.findUnique({ where: { id: customerId }, include: { brand: true } });
  if (!cur) return { error: "ไม่พบลูกค้า" };

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return { error: "ไม่พบเว็บที่เลือก" };

  if (cur.phone === phone && cur.brandId === brandId) return { ok: "ไม่มีการเปลี่ยนแปลง" };

  const dup = await prisma.customer.findUnique({ where: { brandId_phone: { brandId, phone } } });
  if (dup && dup.id !== customerId) return { error: `มีลูกค้าเบอร์นี้ในเว็บ ${brand.name} อยู่แล้ว` };

  await prisma.customer.update({ where: { id: customerId }, data: { phone, brandId } });

  await logAudit({
    userId: session.userId,
    action: "customer.update",
    entity: "Customer",
    entityId: customerId,
    before: { phone: cur.phone, brand: cur.brand.name },
    after: { phone, brand: brand.name },
  });

  revalidatePath(`/customers/${customerId}`);
  return { ok: "บันทึกข้อมูลลูกค้าแล้ว" };
}

// ===== มอบหมาย/ย้ายงานโทรให้พนักงาน (สร้างหรืออัปเดต CampaignContact) =====
export async function assignToAgent(_prev: StatusState, formData: FormData): Promise<StatusState> {
  const session = await requirePermission("customer.manage");

  const customerId = Number(formData.get("customerId"));
  const assignedToId = Number(formData.get("assignedToId")) || null;
  if (!customerId) return { error: "ไม่พบลูกค้า" };

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { error: "ไม่พบลูกค้า" };
  if (customer.status === "DO_NOT_CALL") return { error: "ลูกค้าห้ามโทร — มอบหมายงานไม่ได้" };
  if (!assignedToId) return { error: "กรุณาเลือกพนักงาน" };

  const agent = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!agent || !agent.active) return { error: "ไม่พบพนักงานหรือถูกปิดใช้งาน" };

  const campaignId = await getDefaultCampaignId();
  const existing = await prisma.campaignContact.findUnique({
    where: { campaignId_customerId: { campaignId, customerId } },
  });

  if (existing) {
    // ย้ายผู้รับผิดชอบ + เปิดงานกลับเข้าคิว
    await prisma.campaignContact.update({
      where: { id: existing.id },
      data: { assignedToId, status: "PENDING" },
    });
  } else {
    await prisma.campaignContact.create({
      data: { campaignId, customerId, assignedToId, status: "PENDING" },
    });
  }

  await logAudit({
    userId: session.userId,
    action: "customer.assign",
    entity: "Customer",
    entityId: customerId,
    after: { assignedTo: agent.displayName },
  });

  revalidatePath(`/customers/${customerId}`);
  return { ok: `มอบหมายงานให้ ${agent.displayName} แล้ว` };
}

// ===== Soft-delete: เก็บ/กู้คืนลูกค้า =====
export async function archiveCustomer(formData: FormData): Promise<void> {
  const session = await requirePermission("customer.manage");
  const customerId = Number(formData.get("customerId"));
  if (!customerId) return;
  const cur = await prisma.customer.findUnique({ where: { id: customerId }, select: { archived: true } });
  if (!cur || cur.archived) return;

  await prisma.$transaction([
    prisma.customer.update({ where: { id: customerId }, data: { archived: true } }),
    // ปิดงานค้างในคิว (เหมือนกรณีห้ามโทร) — ไม่ให้ค้างในคิวพนักงาน
    prisma.campaignContact.updateMany({
      where: { customerId, status: "PENDING" },
      data: { status: "DONE", nextCallAt: null },
    }),
  ]);

  await logAudit({
    userId: session.userId,
    action: "customer.archive",
    entity: "Customer",
    entityId: customerId,
    after: { archived: true },
  });
  revalidatePath(`/customers/${customerId}`);
}

export async function restoreCustomer(formData: FormData): Promise<void> {
  const session = await requirePermission("customer.manage");
  const customerId = Number(formData.get("customerId"));
  if (!customerId) return;
  const cur = await prisma.customer.findUnique({ where: { id: customerId }, select: { archived: true } });
  if (!cur || !cur.archived) return;

  await prisma.customer.update({ where: { id: customerId }, data: { archived: false } });
  await logAudit({
    userId: session.userId,
    action: "customer.restore",
    entity: "Customer",
    entityId: customerId,
    after: { archived: false },
  });
  revalidatePath(`/customers/${customerId}`);
}

// ===== บันทึกยอดฝาก (manual) + แจ้งเตือน Telegram เมื่อยอดใหญ่ =====
export async function addDeposit(_prev: StatusState, formData: FormData): Promise<StatusState> {
  const session = await requirePermission("customer.manage");

  const customerId = Number(formData.get("customerId"));
  const amount = Number(formData.get("amount"));
  const date = parseDateOnly(String(formData.get("date") ?? ""));
  if (!customerId || !(amount > 0)) return { error: "กรุณากรอกจำนวนเงินที่มากกว่า 0" };

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { brand: true } });
  if (!customer) return { error: "ไม่พบลูกค้า" };

  await prisma.depositEvent.create({ data: { customerId, amount, date } });

  await logAudit({
    userId: session.userId,
    action: "customer.add_deposit",
    entity: "Customer",
    entityId: customerId,
    after: { amount, date: date.toISOString().slice(0, 10) },
  });

  // แจ้งเตือนยอดฝากใหญ่ → กลุ่มทีม (ข้อ 12)
  const threshold = Number((await getSetting(SETTING_KEYS.bigDepositThreshold)) ?? "5000") || 5000;
  if (amount >= threshold) {
    await notify(
      "big_deposit",
      `💰 <b>ยอดฝากใหญ่</b>\n` +
        `เว็บ: ${escapeHtml(customer.brand.name)}\n` +
        `เบอร์: ${maskPhone(customer.phone)}\n` +
        `ยอด: ${formatMoney(amount)}฿\n` +
        `บันทึกโดย: ${escapeHtml(session.displayName)}`
    );
  }

  revalidatePath(`/customers/${customerId}`);
  return { ok: `บันทึกยอดฝาก ${formatMoney(amount)} บาทแล้ว` };
}

// ===== บันทึกการปรับโบนัส (manual) + แจ้งเตือน Telegram กลุ่มหัวหน้า =====
export async function addBonus(_prev: StatusState, formData: FormData): Promise<StatusState> {
  const session = await requirePermission("customer.manage");

  const customerId = Number(formData.get("customerId"));
  const amount = Number(formData.get("amount"));
  const date = parseDateOnly(String(formData.get("date") ?? ""));
  if (!customerId || !(amount > 0)) return { error: "กรุณากรอกจำนวนเงินที่มากกว่า 0" };

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { brand: true } });
  if (!customer) return { error: "ไม่พบลูกค้า" };

  await prisma.bonusAdjustment.create({ data: { customerId, amount, date } });

  await logAudit({
    userId: session.userId,
    action: "customer.add_bonus",
    entity: "Customer",
    entityId: customerId,
    after: { amount, date: date.toISOString().slice(0, 10) },
  });

  // แจ้งเตือนการปรับโบนัส → กลุ่มหัวหน้า (ข้อ 12)
  await notify(
    "bonus",
    `🎁 <b>ปรับโบนัส</b>\n` +
      `เว็บ: ${escapeHtml(customer.brand.name)}\n` +
      `เบอร์: ${maskPhone(customer.phone)}\n` +
      `ยอด: ${formatMoney(amount)}฿\n` +
      `โดย: ${escapeHtml(session.displayName)}`
  );

  revalidatePath(`/customers/${customerId}`);
  return { ok: `บันทึกโบนัส ${formatMoney(amount)} บาทแล้ว` };
}
