"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type CampaignState = { error?: string; ok?: string };

export async function createCampaign(_prev: CampaignState, formData: FormData): Promise<CampaignState> {
  const session = await requirePermission("campaign.manage");
  const name = String(formData.get("name") ?? "").trim();
  const brandId = Number(formData.get("brandId")) || null;
  if (!name) return { error: "กรุณากรอกชื่อแคมเปญ" };

  const campaign = await prisma.campaign.create({ data: { name, brandId } });
  await logAudit({ userId: session.userId, action: "campaign.create", entity: "Campaign", entityId: campaign.id, after: { name } });
  revalidatePath("/admin/campaigns");
  return { ok: `สร้างแคมเปญ ${name} แล้ว` };
}

export async function renameCampaign(formData: FormData) {
  const session = await requirePermission("campaign.manage");
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  const prev = await prisma.campaign.findUnique({ where: { id }, select: { name: true } });
  if (!prev || prev.name === name) return;
  await prisma.campaign.update({ where: { id }, data: { name } });
  await logAudit({ userId: session.userId, action: "campaign.rename", entity: "Campaign", entityId: id, before: { name: prev.name }, after: { name } });
  revalidatePath("/admin/campaigns");
}

export async function setCampaignActive(formData: FormData) {
  const session = await requirePermission("campaign.manage");
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id) return;
  await prisma.campaign.update({ where: { id }, data: { active } });
  await logAudit({ userId: session.userId, action: "campaign.set_active", entity: "Campaign", entityId: id, after: { active } });
  revalidatePath("/admin/campaigns");
}
