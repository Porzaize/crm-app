// ตรวจว่าโหมด replace นำเข้าซ้ำแล้วไม่เกิดข้อมูลซ้ำ (idempotent) — ใช้แบรนด์ทดสอบชั่วคราว แล้วลบทิ้ง
// รัน: npx tsx scripts/verify-import-idempotent.ts   (กระทบ DB ตาม DATABASE_URL — สร้าง/ลบเองครบ)
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/db";
import { importExcelFromBuffer } from "../src/lib/import-excel";

const TEST_BRAND = "ทดสอบกันซ้ำ__tmp";

// Excel serial ของวันที่ (ฐาน 1899-12-30)
const serial = (y: number, m: number, d: number) =>
  (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;

function buildBuffer(): Buffer {
  // header 4 แถว (index 0..3) แล้วข้อมูลเริ่ม index 4 — ตรงกับ HEADER_ROWS ใน importer
  // ใส่เซลล์ที่ A1 เพื่อ "ตรึง" ช่วง (range) ให้เริ่มที่แถว 0 ไม่งั้น xlsx จะตัดแถวว่างด้านบนทิ้ง แล้วข้อมูลเลื่อนขึ้น
  const rows: unknown[][] = [["CRM"], [], [], []];
  // คอลัมน์: 1=เบอร์, 2=วันโทร(serial), 3=เวลา(HH.MM), 4=รับสาย bool, 6=sms, 8=ฝากวันที่1 (step2), 72=โบนัส, 73=ผลสาย
  const mk = (phone: string, callDay: number, depDay: number, dep: number, bonus: number, outcome: string) => {
    const r: unknown[] = new Array(74).fill(null);
    r[1] = phone;
    r[2] = serial(2026, 6, callDay);
    r[3] = 10.3;
    r[4] = outcome === "รับสาย";
    r[6] = false;
    r[8 + (depDay - 1) * 2] = dep; // ยอดฝากของวันที่ depDay
    if (bonus) r[72] = bonus;
    r[73] = outcome;
    return r;
  };
  rows.push(mk("0900000001", 10, 10, 500, 100, "รับสาย"));
  rows.push(mk("0900000002", 11, 11, 300, 0, "ไม่รับสาย"));

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TEST_BRAND);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function counts() {
  const brand = await prisma.brand.findUnique({ where: { name: TEST_BRAND } });
  if (!brand) return { deposits: 0, bonuses: 0, callLogs: 0, customers: 0 };
  const customers = await prisma.customer.findMany({ where: { brandId: brand.id }, select: { id: true } });
  const ids = customers.map((c) => c.id);
  const [deposits, bonuses, contacts] = await Promise.all([
    prisma.depositEvent.count({ where: { customerId: { in: ids } } }),
    prisma.bonusAdjustment.count({ where: { customerId: { in: ids } } }),
    prisma.campaignContact.findMany({ where: { customerId: { in: ids } }, select: { id: true } }),
  ]);
  const callLogs = await prisma.callLog.count({ where: { contactId: { in: contacts.map((c) => c.id) } } });
  return { deposits, bonuses, callLogs, customers: ids.length };
}

async function cleanup() {
  const brand = await prisma.brand.findUnique({ where: { name: TEST_BRAND } });
  if (!brand) return;
  const customers = await prisma.customer.findMany({ where: { brandId: brand.id }, select: { id: true } });
  const ids = customers.map((c) => c.id);
  const contacts = await prisma.campaignContact.findMany({ where: { customerId: { in: ids } }, select: { id: true } });
  const contactIds = contacts.map((c) => c.id);
  await prisma.callLog.deleteMany({ where: { contactId: { in: contactIds } } });
  await prisma.depositEvent.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.bonusAdjustment.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.statusChangeLog.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.campaignContact.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.customer.deleteMany({ where: { brandId: brand.id } });
  await prisma.brand.delete({ where: { id: brand.id } });
}

async function main() {
  await cleanup(); // เผื่อค้างจากรอบก่อน
  const buf = buildBuffer();

  await importExcelFromBuffer(prisma, buf, { mode: "replace" });
  const a = await counts();
  console.log("หลัง replace ครั้งที่ 1:", a);

  await importExcelFromBuffer(prisma, buf, { mode: "replace" });
  const b = await counts();
  console.log("หลัง replace ครั้งที่ 2:", b);

  const idempotent = a.deposits === b.deposits && a.bonuses === b.bonuses && a.callLogs === b.callLogs;
  console.log(`✓ replace idempotent (ไม่ซ้ำ): ${idempotent}`);

  await importExcelFromBuffer(prisma, buf, { mode: "append" });
  const c = await counts();
  console.log("หลัง append (พิสูจน์ว่า append ซ้ำ):", c);
  const appendDup = c.deposits === b.deposits * 2;
  console.log(`✓ append ทำให้ซ้ำ (ตามคาด): ${appendDup}`);

  await cleanup();
  console.log("ลบแบรนด์ทดสอบแล้ว");

  if (!idempotent || !appendDup) {
    console.error("❌ ผลไม่ตรงคาด");
    process.exit(1);
  }
  console.log("✅ ผ่านทั้งหมด");
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await cleanup().catch(() => {});
    process.exit(1);
  });
