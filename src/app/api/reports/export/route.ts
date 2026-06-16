import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/auth";
import { getBrandSummary, parseYMD } from "@/lib/report";

// ข้อ 5: Export รายงานสรุป (ข้อ 4) เป็นไฟล์ Excel — reuse getBrandSummary ตัวเดียวกับหน้า /reports
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** สัดส่วน part/whole เป็นเศษ (เก็บใน cell แบบ % ของ Excel) — ไม่มีตัวหารคืน null = ช่องว่าง */
function frac(part: number, whole: number): number | null {
  if (!whole) return null;
  return part / whole;
}

export async function GET(req: NextRequest) {
  await requirePermission("report.view");

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!parseYMD(from) || !parseYMD(to) || from > to) {
    return NextResponse.json({ error: "ช่วงวันที่ไม่ถูกต้อง" }, { status: 400 });
  }

  let result;
  try {
    result = await getBrandSummary(from, to);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" },
      { status: 400 }
    );
  }

  const header = [
    "เว็บ",
    "โทรติดตาม",
    "รับสาย",
    "รับสาย %",
    "ไม่รับสาย",
    "ไม่รับสาย %",
    "กลับมาฝาก (คน)",
    "ยอดกลับมาฝาก",
    "ยอดโบนัส",
    "โบนัส/ยอดฝาก %",
  ];

  const aoa: (string | number | null)[][] = [
    [`สรุปผลติดตามลูกค้า ${from} ถึง ${to}`],
    [],
    header,
  ];
  for (const r of result.rows) {
    aoa.push([
      r.name,
      r.calls,
      r.answered,
      frac(r.answered, r.calls),
      r.noAnswer,
      frac(r.noAnswer, r.calls),
      r.depositors,
      r.depositTotal,
      r.bonusTotal,
      frac(r.bonusTotal, r.depositTotal),
    ]);
  }
  const t = result.total;
  aoa.push([
    "รวม",
    t.calls,
    t.answered,
    frac(t.answered, t.calls),
    t.noAnswer,
    frac(t.noAnswer, t.calls),
    t.depositors,
    t.depositTotal,
    t.bonusTotal,
    frac(t.bonusTotal, t.depositTotal),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 14 },
    { wch: 11 },
    { wch: 9 },
    { wch: 9 },
    { wch: 11 },
    { wch: 11 },
    { wch: 15 },
    { wch: 15 },
    { wch: 14 },
    { wch: 14 },
  ];

  // จัดรูปแบบตัวเลขรายคอลัมน์ (data + แถวรวม): row 3 ถึงท้าย (0-based)
  const COUNT_COLS = [1, 2, 4, 6];
  const MONEY_COLS = [7, 8];
  const PCT_COLS = [3, 5, 9];
  const firstDataRow = 3;
  const lastRow = aoa.length - 1;
  for (let r = firstDataRow; r <= lastRow; r++) {
    for (const c of COUNT_COLS) setFmt(ws, r, c, "#,##0");
    for (const c of MONEY_COLS) setFmt(ws, r, c, "#,##0.00");
    for (const c of PCT_COLS) setFmt(ws, r, c, "0.0%");
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "รายงานสรุป");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${from}_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

/** ใส่ number-format ให้ cell ถ้ามีค่าเป็นตัวเลข */
function setFmt(ws: XLSX.WorkSheet, r: number, c: number, z: string) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr] as XLSX.CellObject | undefined;
  if (cell && cell.t === "n") cell.z = z;
}
