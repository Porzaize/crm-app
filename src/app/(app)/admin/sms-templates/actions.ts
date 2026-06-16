"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export type TemplateState = { error?: string; ok?: string };

function parseNameBody(formData: FormData): { name: string; body: string } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อ template" };
  if (!body) return { error: "กรุณากรอกเนื้อความ" };
  return { name, body };
}

export async function createTemplate(
  _prev: TemplateState,
  formData: FormData
): Promise<TemplateState> {
  await requirePermission("sms.manage");
  const parsed = parseNameBody(formData);
  if ("error" in parsed) return { error: parsed.error };

  const max = await prisma.smsTemplate.aggregate({ _max: { sortOrder: true } });
  await prisma.smsTemplate.create({
    data: { name: parsed.name, body: parsed.body, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });

  revalidatePath("/admin/sms-templates");
  return { ok: `เพิ่ม template “${parsed.name}” แล้ว` };
}

export async function updateTemplate(
  _prev: TemplateState,
  formData: FormData
): Promise<TemplateState> {
  await requirePermission("sms.manage");
  const id = Number(formData.get("id"));
  if (!id) return { error: "ไม่พบ template" };
  const parsed = parseNameBody(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.smsTemplate.update({
    where: { id },
    data: { name: parsed.name, body: parsed.body },
  });

  revalidatePath("/admin/sms-templates");
  return { ok: "บันทึกแล้ว" };
}

export async function setTemplateActive(formData: FormData) {
  await requirePermission("sms.manage");
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id) return;
  await prisma.smsTemplate.update({ where: { id }, data: { active } });
  revalidatePath("/admin/sms-templates");
}

/** ย้ายลำดับขึ้น/ลง — สลับ sortOrder กับเพื่อนบ้านในลำดับปัจจุบัน */
export async function moveTemplate(formData: FormData) {
  await requirePermission("sms.manage");
  const id = Number(formData.get("id"));
  const dir = String(formData.get("dir") ?? "");
  if (!id || (dir !== "up" && dir !== "down")) return;

  const all = await prisma.smsTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  // sortOrder อาจซ้ำกัน (ค่าเริ่ม 0) — ใช้ index+1 ทั้งคู่กันค้าง
  await prisma.$transaction([
    prisma.smsTemplate.update({ where: { id: a.id }, data: { sortOrder: swapIdx + 1 } }),
    prisma.smsTemplate.update({ where: { id: b.id }, data: { sortOrder: idx + 1 } }),
  ]);
  revalidatePath("/admin/sms-templates");
}
