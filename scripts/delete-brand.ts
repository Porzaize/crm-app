import { prisma } from "../src/lib/db";

async function main() {
  const name = process.argv[2] || "แสงเพชร";
  const brand = await prisma.brand.findUnique({ where: { name } });
  if (!brand) {
    console.log(`ไม่พบเว็บ "${name}" (อาจลบไปแล้ว)`);
    return;
  }
  const customerIds = (await prisma.customer.findMany({ where: { brandId: brand.id }, select: { id: true } })).map((c) => c.id);
  const contactIds = (await prisma.campaignContact.findMany({ where: { customerId: { in: customerIds } }, select: { id: true } })).map((c) => c.id);

  const r = await prisma.$transaction([
    prisma.callLog.deleteMany({ where: { contactId: { in: contactIds } } }),
    prisma.depositEvent.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.bonusAdjustment.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.statusChangeLog.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.auditLog.deleteMany({ where: { entity: "Customer", entityId: { in: customerIds } } }),
    prisma.campaignContact.deleteMany({ where: { id: { in: contactIds } } }),
    prisma.customer.deleteMany({ where: { brandId: brand.id } }),
    prisma.campaign.deleteMany({ where: { brandId: brand.id } }),
    prisma.brand.delete({ where: { id: brand.id } }),
  ]);

  console.log(`ลบเว็บ "${name}" เสร็จ:`);
  console.log(`  CallLog: ${r[0].count}`);
  console.log(`  DepositEvent: ${r[1].count}`);
  console.log(`  BonusAdjustment: ${r[2].count}`);
  console.log(`  StatusChangeLog: ${r[3].count}`);
  console.log(`  AuditLog(Customer): ${r[4].count}`);
  console.log(`  CampaignContact: ${r[5].count}`);
  console.log(`  Customer: ${r[6].count}`);
  console.log(`  Campaign: ${r[7].count}`);
  console.log(`  Brand: ลบแล้ว`);

  const left = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  console.log("เว็บที่เหลือ:", left.map((b) => b.name).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
