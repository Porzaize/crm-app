import { prisma } from "../src/lib/db";

// seed template เริ่มต้น (idempotent ตามชื่อ) — ให้ dropdown ใช้งานได้ทันที
const SEED = [
  {
    name: "ทวงรัก + โปร 20%",
    body: "สวัสดีค่ะ ลูกค้า {{เว็บ}} วันนี้รับ {{โปร}} เมื่อกลับมาฝาก ทักแอดมินรับโปรได้เลยค่ะ",
  },
  {
    name: "แจ้งโปรโมชัน",
    body: "{{เว็บ}} มีโปรพิเศษ {{โปร}} สำหรับสมาชิกเก่า รีบใช้สิทธิ์วันนี้นะคะ",
  },
  {
    name: "ติดตามหลังไม่รับสาย",
    body: "ติดต่อจาก {{เว็บ}} ไม่ได้รับสายค่ะ รบกวนติดต่อกลับเพื่อรับ {{โปร}} ค่ะ",
  },
];

async function main() {
  let created = 0;
  for (let i = 0; i < SEED.length; i++) {
    const s = SEED[i];
    const exists = await prisma.smsTemplate.findFirst({ where: { name: s.name } });
    if (exists) {
      console.log("skip (มีอยู่แล้ว):", s.name);
      continue;
    }
    await prisma.smsTemplate.create({ data: { ...s, sortOrder: i + 1 } });
    created++;
    console.log("created:", s.name);
  }
  console.log(`\nseed เสร็จ — สร้างใหม่ ${created} อัน`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
