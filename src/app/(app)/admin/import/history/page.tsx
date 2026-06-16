import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const fmtInt = (n: number) => Number(n ?? 0).toLocaleString("th-TH");

/** ดึงค่าตัวเลขจาก after (JSON) อย่างปลอดภัย */
function num(rec: Record<string, unknown>, key: string): number {
  const v = rec[key];
  return typeof v === "number" ? v : 0;
}

/** ชื่อไฟล์ล้วน (ตัด path ของฝั่ง CLI ออก) */
function baseName(file: unknown): string {
  if (typeof file !== "string" || !file) return "—";
  const parts = file.split(/[\\/]/);
  return parts[parts.length - 1] || file;
}

export default async function ImportHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission("import.run");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where = { action: "import.excel" as const };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { displayName: true } } },
      orderBy: { id: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `/admin/import/history?page=${p}`;

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>ประวัติการนำเข้า</h1>
        <Link href="/admin/import" className="btn-link back"><span className="arr">←</span> นำเข้าข้อมูล</Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <span className="muted">ทั้งหมด {fmtInt(total)} ครั้ง</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>โดย</th>
                <th>ช่องทาง</th>
                <th>ไฟล์</th>
                <th className="num">ลูกค้า</th>
                <th className="num">งาน</th>
                <th className="num">บันทึกโทร</th>
                <th className="num">ยอดฝาก</th>
                <th className="num">โบนัส</th>
                <th className="num">ข้ามซ้ำ</th>
                <th className="num">แถวซ้ำ</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={11} className="muted" style={{ textAlign: "center" }}>
                    ยังไม่มีประวัติการนำเข้า
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const a = (log.after && typeof log.after === "object" ? log.after : {}) as Record<string, unknown>;
                const viaWeb = a.via === "web";
                return (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(log.createdAt)}</td>
                    <td>{log.user?.displayName ?? <span className="muted">ระบบ</span>}</td>
                    <td>
                      <span className={`badge ${viaWeb ? "green" : "gray"}`}>
                        {viaWeb ? "เว็บ" : "CLI"}
                      </span>
                    </td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={typeof a.file === "string" ? a.file : undefined}>
                      {baseName(a.file)}
                    </td>
                    <td className="num">{fmtInt(num(a, "customers"))}</td>
                    <td className="num">{fmtInt(num(a, "contacts"))}</td>
                    <td className="num">{fmtInt(num(a, "callLogs"))}</td>
                    <td className="num">{fmtInt(num(a, "deposits"))}</td>
                    <td className="num">{fmtInt(num(a, "bonuses"))}</td>
                    <td className="num">{fmtInt(num(a, "skippedExisting"))}</td>
                    <td className="num">{fmtInt(num(a, "duplicateRows"))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {page > 1 && <Link href={qs(page - 1)} className="btn-link back"><span className="arr">←</span> ก่อนหน้า</Link>}
            <span className="muted">หน้า {page} / {totalPages}</span>
            {page < totalPages && <Link href={qs(page + 1)} className="btn-link">ถัดไป <span className="arr">→</span></Link>}
          </div>
        )}
      </div>
    </>
  );
}
