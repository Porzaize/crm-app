"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, requirePermission, can } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBangkokLocal } from "@/lib/dates";
import { OUTCOME_LABELS } from "@/lib/labels";
import type { CallOutcome } from "@prisma/client";

/** มอบหมายงานโทรหลายรายการให้พนักงานคนเดียว (เฉพาะหัวหน้า) */
export async function bulkAssignContacts(formData: FormData): Promise<void> {
  const session = await requirePermission("queue.assign");
  const agentId = Number(formData.get("agentId"));
  const ids = formData.getAll("contactIds").map(Number).filter((n) => n > 0);
  if (!agentId || ids.length === 0) return;

  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent || !agent.active) return;

  const r = await prisma.campaignContact.updateMany({
    where: { id: { in: ids }, status: "PENDING" },
    data: { assignedToId: agentId },
  });

  await logAudit({
    userId: session.userId,
    action: "customer.bulk_assign",
    entity: "CampaignContact",
    entityId: 0,
    after: { count: r.count, assignedTo: agent.displayName },
  });

  revalidatePath("/queue");
}

export type LogCallState = { error?: string };

const VALID_OUTCOMES = new Set(Object.keys(OUTCOME_LABELS));

export async function logCall(
  _prev: LogCallState,
  formData: FormData
): Promise<LogCallState> {
  const session = await requireSession();

  const contactId = Number(formData.get("contactId"));
  if (!contactId) return { error: "ไม่พบรายการ" };

  const contact = await prisma.campaignContact.findUnique({
    where: { id: contactId },
    include: { customer: true },
  });
  if (!contact) return { error: "ไม่พบรายการ" };

  // สิทธิ์: agent บันทึกได้เฉพาะงานของตัวเอง
  if (!can(session, "queue.call_any") && contact.assignedToId !== session.userId) {
    return { error: "คุณไม่มีสิทธิ์บันทึกผลของรายการนี้" };
  }

  // กฎห้ามโทร — กันยิงตรงผ่าน action
  if (contact.customer.status === "DO_NOT_CALL") {
    return { error: "ลูกค้ารายนี้อยู่ในสถานะห้ามโทร" };
  }

  const outcome = String(formData.get("outcome") ?? "");
  if (!VALID_OUTCOMES.has(outcome)) return { error: "กรุณาเลือกผลสาย" };

  const promo = formData.get("promo") === "on";
  const smsSent = formData.get("smsSent") === "on";
  const note = String(formData.get("note") ?? "").trim() || null;
  const nextCallAt = parseBangkokLocal(String(formData.get("nextCallAt") ?? ""));

  // เก็บ template ที่ใช้ — เฉพาะเมื่อติ๊กส่ง SMS และ template ยัง valid (กันค่าปลอมจาก client)
  let smsTemplateId: number | null = null;
  if (smsSent) {
    const tid = Number(formData.get("smsTemplateId"));
    if (tid) {
      const tpl = await prisma.smsTemplate.findUnique({ where: { id: tid }, select: { id: true } });
      smsTemplateId = tpl?.id ?? null;
    }
  }

  await prisma.$transaction([
    prisma.callLog.create({
      data: {
        contactId: contact.id,
        callerId: session.userId,
        calledAt: new Date(),
        outcome: outcome as CallOutcome,
        disposition: promo ? "PROMO_20" : "NONE",
        smsSent,
        smsTemplateId,
        note,
      },
    }),
    prisma.campaignContact.update({
      where: { id: contact.id },
      // มีนัด -> กลับเข้าคิว (PENDING) ; ไม่มีนัด -> ปิดงาน + ล้างนัดเดิม
      data: nextCallAt
        ? { status: "PENDING", nextCallAt }
        : { status: "DONE", nextCallAt: null },
    }),
  ]);

  redirect("/queue");
}
