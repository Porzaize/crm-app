"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type BrandState = { error?: string; ok?: string };

export async function createBrand(_prev: BrandState, formData: FormData): Promise<BrandState> {
  const admin = await requirePermission("brand.manage");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อเว็บ" };

  const dup = await prisma.brand.findUnique({ where: { name } });
  if (dup) return { error: "มีเว็บชื่อนี้อยู่แล้ว" };

  const brand = await prisma.brand.create({ data: { name } });
  await logAudit({ userId: admin.userId, action: "brand.create", entity: "Brand", entityId: brand.id, after: { brand: name } });
  revalidatePath("/admin/brands");
  return { ok: `เพิ่มเว็บ ${name} แล้ว` };
}

export async function renameBrand(formData: FormData) {
  const admin = await requirePermission("brand.manage");
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const prev = await prisma.brand.findUnique({ where: { id }, select: { name: true } });
  if (!prev || prev.name === name) return;

  const dup = await prisma.brand.findUnique({ where: { name } });
  if (dup) return; // ชื่อซ้ำ — ไม่เปลี่ยน (กัน unique error)

  await prisma.brand.update({ where: { id }, data: { name } });
  await logAudit({
    userId: admin.userId,
    action: "brand.rename",
    entity: "Brand",
    entityId: id,
    before: { brand: prev.name },
    after: { brand: name },
  });
  revalidatePath("/admin/brands");
}
