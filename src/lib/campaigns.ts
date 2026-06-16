import "server-only";
import { prisma } from "@/lib/db";

// campaign เริ่มต้นสำหรับงานโทรที่สร้างเอง (ไม่ผ่าน import)
// ใช้ campaign แรกที่มี (ตัวที่ import สร้าง) เพื่อให้งาน manual อยู่รวมกับงานนำเข้า
// ถ้ายังไม่มีเลย ค่อยสร้างตัวกลางขึ้นมา
const FALLBACK_CAMPAIGN_NAME = "ติดตามลูกค้า";

export async function getDefaultCampaignId(): Promise<number> {
  const existing = await prisma.campaign.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.campaign.create({ data: { name: FALLBACK_CAMPAIGN_NAME } });
  return created.id;
}
