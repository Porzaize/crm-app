import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { bangkokDateTime } from "@/lib/dates";
import { formatDateTime, AUDIT_ACTION_LABELS, auditActionLabel } from "@/lib/labels";
import { renderAuditDiff } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseYMD(s: string | undefined): { y: number; m: number; d: number } | null {
  const m = (s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; from?: string; to?: string; page?: string }>;
}) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const action = sp.action && sp.action in AUDIT_ACTION_LABELS ? sp.action : undefined;
  const actor = sp.actor; // "system" | "<id>" | undefined
  const f = parseYMD(sp.from);
  const t = parseYMD(sp.to);

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(actor === "system"
      ? { userId: null }
      : actor && /^\d+$/.test(actor)
        ? { userId: Number(actor) }
        : {}),
    ...(f && t
      ? {
          createdAt: {
            gte: bangkokDateTime(f.y, f.m, f.d, 0, 0),
            lt: new Date(bangkokDateTime(t.y, t.m, t.d, 0, 0).getTime() + DAY_MS),
          },
        }
      : {}),
  };

  const [total, logs, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { displayName: true } } },
      orderBy: { id: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.findMany({ orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (action) u.set("action", action);
    if (actor) u.set("actor", actor);
    if (sp.from) u.set("from", sp.from);
    if (sp.to) u.set("to", sp.to);
    u.set("page", String(p));
    return `/admin/audit?${u.toString()}`;
  };

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Audit Log</h1>
        <Link href="/admin" className="btn-secondary">← ผู้ใช้งาน</Link>
      </div>

      <div className="card">
        <form className="row" method="get" style={{ flexWrap: "wrap" }}>
          <div>
            <label htmlFor="action">ประเภท</label>
            <select id="action" name="action" defaultValue={action ?? ""}>
              <option value="">ทั้งหมด</option>
              {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="actor">ผู้ทำ</label>
            <select id="actor" name="actor" defaultValue={actor ?? ""}>
              <option value="">ทั้งหมด</option>
              <option value="system">ระบบ (นำเข้า)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from">ตั้งแต่วันที่</label>
            <input id="from" name="from" type="date" defaultValue={sp.from ?? ""} />
          </div>
          <div>
            <label htmlFor="to">ถึงวันที่</label>
            <input id="to" name="to" type="date" defaultValue={sp.to ?? ""} />
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
            <button type="submit">กรอง</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          <span className="muted">ทั้งหมด {total.toLocaleString("th-TH")} รายการ</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ผู้ทำ</th>
                <th>การกระทำ</th>
                <th>รายการ</th>
                <th>การเปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center" }}>ไม่มีรายการ</td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(log.createdAt)}</td>
                  <td>{log.user?.displayName ?? <span className="muted">ระบบ</span>}</td>
                  <td>{auditActionLabel(log.action)}</td>
                  <td>
                    {log.entity === "Customer" ? (
                      <Link href={`/customers/${log.entityId}`}>ลูกค้า #{log.entityId}</Link>
                    ) : (
                      `${log.entity} #${log.entityId}`
                    )}
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{renderAuditDiff(log.before, log.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {page > 1 && <Link href={qs(page - 1)} className="btn-secondary">← ก่อนหน้า</Link>}
            <span className="muted">หน้า {page} / {totalPages}</span>
            {page < totalPages && <Link href={qs(page + 1)} className="btn-secondary">ถัดไป →</Link>}
          </div>
        )}
      </div>
    </>
  );
}
