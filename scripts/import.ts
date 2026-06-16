import { PrismaClient } from "@prisma/client";
import path from "path";
import { importExcelFromFile, type ImportMode } from "../src/lib/import-excel";
import { logAudit } from "../src/lib/audit";
import { notify, escapeHtml } from "../src/lib/telegram";

const fmtInt = (n: number) => n.toLocaleString("th-TH");

const prisma = new PrismaClient();

// โหมด: ค่าเริ่มต้น replace (idempotent — รันซ้ำไม่เกิดข้อมูลซ้ำ) กันพลาดบน CLI
// ใช้: npm run import [path] [--mode=replace|skipExisting|append]
function parseArgs(): { file: string; mode: ImportMode } {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="))?.split("=")[1];
  const file =
    args.find((a) => !a.startsWith("--")) ||
    path.resolve(process.cwd(), "..", "CRM_โทรติดตามลูกค้า_ลูกค้าขาดฝาก_มิถุนายน.xlsx");
  const valid: ImportMode[] = ["append", "skipExisting", "replace"];
  const mode = (valid as string[]).includes(modeArg ?? "") ? (modeArg as ImportMode) : "replace";
  return { file, mode };
}

async function main() {
  const { file, mode } = parseArgs();
  console.log(`กำลังนำเข้าจาก: ${file}\nโหมด: ${mode}` + (mode === "replace"
    ? " (นำเข้าทับ — ลบ event จากการนำเข้าเดิมของเดือนในไฟล์ก่อนสร้างใหม่; idempotent)"
    : mode === "append"
    ? " ⚠️ (เพิ่มทุกแถว — รันซ้ำจะได้ข้อมูลซ้ำ!)"
    : " (ข้ามลูกค้าที่มีอยู่แล้ว)"));

  const t0 = Date.now();
  const summary = await importExcelFromFile(prisma, file, { mode });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n=== สรุปการนำเข้า (" + secs + "s) ===");
  console.table(summary);

  // audit (ข้อ 10): 1 รายการต่อการ import พร้อมสรุปจำนวน (userId null = ระบบ)
  await logAudit({ userId: null, action: "import.excel", entity: "Import", entityId: 0, after: { ...summary, file, mode, via: "cli" } });

  // แจ้งเตือน Telegram กลุ่มทีม — นำเข้าเสร็จ (ข้อ 12)
  await notify(
    "import",
    `📥 <b>นำเข้าข้อมูลเสร็จ</b> (${escapeHtml(secs)}s)\n` +
      `ลูกค้า: ${fmtInt(summary.customers)} · งาน: ${fmtInt(summary.contacts)}\n` +
      `บันทึกโทร: ${fmtInt(summary.callLogs)} · ยอดฝาก: ${fmtInt(summary.deposits)} · โบนัส: ${fmtInt(summary.bonuses)}\n` +
      `ข้ามห้ามโทร: ${fmtInt(summary.skippedDoNotCall)} · แถวซ้ำ: ${fmtInt(summary.duplicateRows)}`
  );

  // มอบงาน contact ที่ยัง PENDING ให้ agent1 เพื่อให้ตัวอย่างคิวโทรมีข้อมูล
  const agent = await prisma.user.findUnique({ where: { username: "agent1" } });
  if (agent) {
    const r = await prisma.campaignContact.updateMany({
      where: { status: "PENDING", assignedToId: null },
      data: { assignedToId: agent.id },
    });
    console.log(`มอบงานค้าง ${r.count} รายการให้ agent1`);
  }
}

main()
  .catch(async (e) => {
    console.error(e);
    // แจ้งเตือน Telegram กลุ่มทีม — นำเข้าพัง (ข้อ 12)
    await notify("import", `❌ <b>นำเข้าข้อมูลล้มเหลว</b>\n${escapeHtml(String(e?.message ?? e))}`).catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
