// ครั้งเดียว: ทำเครื่องหมายว่าข้อมูลฝาก/โบนัสที่มีอยู่เดิม "มาจากการนำเข้า"
// (ก่อนหน้านี้ทั้งหมดมาจาก import — ตั้ง importedAt=createdAt เพื่อให้โหมด replace ลบ/แทนได้ถูกต้อง)
import { prisma } from "../src/lib/db";

async function main() {
  const dep = await prisma.$executeRaw`UPDATE "DepositEvent" SET "importedAt" = "createdAt" WHERE "importedAt" IS NULL`;
  const bon = await prisma.$executeRaw`UPDATE "BonusAdjustment" SET "importedAt" = "createdAt" WHERE "importedAt" IS NULL`;
  console.log(`backfilled DepositEvent: ${dep} แถว, BonusAdjustment: ${bon} แถว`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
