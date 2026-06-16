import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, can } from "@/lib/auth";
import { importExcelFromBuffer, analyzeExcelFromBuffer, type ImportMode } from "@/lib/import-excel";
import { logAudit } from "@/lib/audit";
import { notify, escapeHtml } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fmtInt = (n: number) => n.toLocaleString("th-TH");

// อัปโหลดไฟล์ Excel นำเข้าผ่านเว็บ (SUPERVISOR+)
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !can(session, "import.run")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  let file: FormDataEntryValue | null = null;
  let mode = "append"; // "analyze" = ตรวจสอบ, ที่เหลือ = ImportMode (append/skipExisting/replace)
  try {
    const form = await req.formData();
    file = form.get("file");
    mode = String(form.get("mode") ?? "append");
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง (ต้องเป็น multipart form)" }, { status: 400 });
  }
  const IMPORT_MODES: ImportMode[] = ["append", "skipExisting", "replace"];
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .xlsx / .xls" }, { status: 400 });
  }

  // โหมดตรวจสอบ (preview) — ไม่เขียน DB เพื่อเตือนข้อมูลซ้ำก่อน
  if (mode === "analyze") {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const preview = await analyzeExcelFromBuffer(prisma, buf);
      return NextResponse.json({ ok: true, preview });
    } catch (e) {
      console.error("analyze failed:", e);
      return NextResponse.json({ error: "อ่านไฟล์ไม่สำเร็จ: " + String((e as Error)?.message ?? e) }, { status: 500 });
    }
  }

  const importMode = (IMPORT_MODES as string[]).includes(mode) ? (mode as ImportMode) : "append";
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const t0 = Date.now();
    const summary = await importExcelFromBuffer(prisma, buf, { mode: importMode });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);

    await logAudit({
      userId: session.userId,
      action: "import.excel",
      entity: "Import",
      entityId: 0,
      after: { ...summary, file: file.name, via: "web" },
    });

    const modeLabel = importMode === "replace" ? "นำเข้าทับ (replace)" : importMode === "skipExisting" ? "เฉพาะรายใหม่" : "เพิ่มทั้งหมด";
    await notify(
      "import",
      `📥 <b>นำเข้าข้อมูล (อัปโหลดเว็บ)</b> (${escapeHtml(secs)}s) · ${escapeHtml(modeLabel)}\n` +
        `โดย: ${escapeHtml(session.displayName)} · ไฟล์: ${escapeHtml(file.name)}\n` +
        `ลูกค้า: ${fmtInt(summary.customers)} · งาน: ${fmtInt(summary.contacts)}\n` +
        `บันทึกโทร: ${fmtInt(summary.callLogs)} · ยอดฝาก: ${fmtInt(summary.deposits)} · โบนัส: ${fmtInt(summary.bonuses)}\n` +
        `ลบของเดิม: ${fmtInt(summary.deletedEvents)} · ข้ามรายซ้ำ: ${fmtInt(summary.skippedExisting)} · ข้ามห้ามโทร: ${fmtInt(summary.skippedDoNotCall)} · แถวซ้ำในไฟล์: ${fmtInt(summary.duplicateRows)}`
    );

    return NextResponse.json({ ok: true, summary, secs });
  } catch (e) {
    console.error("web import failed:", e);
    await notify("import", `❌ <b>นำเข้าข้อมูล (อัปโหลดเว็บ) ล้มเหลว</b>\n${escapeHtml(String((e as Error)?.message ?? e))}`).catch(() => {});
    return NextResponse.json({ error: "นำเข้าล้มเหลว: " + String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
