import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatMoney, formatDateTime } from "@/lib/labels";
import { bangkokYMD, ymdAddDays, dateOnlyUTC } from "@/lib/dates";

export const dynamic = "force-dynamic";

// เกณฑ์เตือนความผิดปกติ (ป้องกันทุจริต)
const HIGH_DEPOSIT_TOTAL = 50000; // ยอดฝาก manual รวมต่อคนต่อช่วง
const MANY_BONUSES = 20; // จำนวนครั้งปรับโบนัส
const MANY_FAILED_LOGINS = 5; // จำนวนล็อกอินล้มเหลว

const ACTIONS = [
  "customer.add_deposit",
  "customer.add_bonus",
  "customer.status_change",
  "customer.archive",
  "customer.update",
  "customer.bulk_assign",
  "user.reset_password",
  "user.login",
  "user.login_failed",
];

type Agg = {
  name: string;
  logins: number;
  failedLogins: number;
  deposits: number;
  depositSum: number;
  bonuses: number;
  bonusSum: number;
  statusChanges: number;
  dncSet: number;
  archives: number;
  resets: number;
  flags: string[];
};

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("activity.view");
  const sp = await searchParams;
  const today = bangkokYMD();
  const toYMD = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : today;
  const fromYMD = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : ymdAddDays(toYMD, -6);

  const [fy, fm, fd] = fromYMD.split("-").map(Number);
  const [ty, tm, td] = toYMD.split("-").map(Number);
  const fromDate = dateOnlyUTC(fy, fm, fd);
  const toExcl = new Date(dateOnlyUTC(ty, tm, td).getTime() + 24 * 60 * 60 * 1000);

  const logs = await prisma.auditLog.findMany({
    where: { action: { in: ACTIONS }, createdAt: { gte: fromDate, lt: toExcl } },
    include: { user: { select: { displayName: true } } },
    orderBy: { id: "desc" },
  });

  // ===== รวมต่อผู้ใช้ =====
  const byUser = new Map<string, Agg>();
  const suspicious: { when: Date; who: string; action: string; detail: string }[] = [];

  for (const l of logs) {
    const key = l.userId == null ? "system" : String(l.userId);
    const name = l.user?.displayName ?? (l.userId == null ? "ระบบ" : `#${l.userId}`);
    let a = byUser.get(key);
    if (!a) {
      a = { name, logins: 0, failedLogins: 0, deposits: 0, depositSum: 0, bonuses: 0, bonusSum: 0, statusChanges: 0, dncSet: 0, archives: 0, resets: 0, flags: [] };
      byUser.set(key, a);
    }
    const after = (l.after ?? {}) as Record<string, unknown>;

    switch (l.action) {
      case "user.login":
        a.logins++;
        break;
      case "user.login_failed":
        a.failedLogins++;
        break;
      case "customer.add_deposit": {
        a.deposits++;
        a.depositSum += num(after.amount);
        // ธง: ตั้งวันที่ย้อนหลัง/ล่วงหน้า ต่างจากวันที่บันทึกจริง
        const recDay = typeof after.date === "string" ? after.date : null;
        const entryDay = bangkokYMD(l.createdAt);
        if (recDay && recDay !== entryDay) {
          suspicious.push({ when: l.createdAt, who: name, action: "ยอดฝาก", detail: `ตั้งวันที่ ${recDay} (บันทึกจริง ${entryDay}) จำนวน ${formatMoney(num(after.amount))}฿` });
        }
        break;
      }
      case "customer.add_bonus": {
        a.bonuses++;
        a.bonusSum += num(after.amount);
        const recDay = typeof after.date === "string" ? after.date : null;
        const entryDay = bangkokYMD(l.createdAt);
        if (recDay && recDay !== entryDay) {
          suspicious.push({ when: l.createdAt, who: name, action: "โบนัส", detail: `ตั้งวันที่ ${recDay} (บันทึกจริง ${entryDay}) จำนวน ${formatMoney(num(after.amount))}฿` });
        }
        break;
      }
      case "customer.status_change":
        a.statusChanges++;
        if (after.status === "DO_NOT_CALL") a.dncSet++;
        break;
      case "customer.archive":
        a.archives++;
        break;
      case "user.reset_password":
        a.resets++;
        break;
    }
  }

  // ธงเตือนต่อผู้ใช้
  for (const a of byUser.values()) {
    if (a.depositSum >= HIGH_DEPOSIT_TOTAL) a.flags.push(`ยอดฝาก manual สูง (${formatMoney(a.depositSum)}฿)`);
    if (a.bonuses >= MANY_BONUSES) a.flags.push(`ปรับโบนัสบ่อย (${a.bonuses} ครั้ง)`);
    if (a.failedLogins >= MANY_FAILED_LOGINS) a.flags.push(`ล็อกอินล้มเหลวบ่อย (${a.failedLogins} ครั้ง)`);
  }

  const rows = [...byUser.values()].sort((x, y) => y.depositSum + y.bonusSum - (x.depositSum + x.bonusSum));
  const preset = (label: string, f: string, t: string) => (
    <Link href={`/admin/activity?from=${f}&to=${t}`} className="btn-secondary" style={{ padding: "0.3rem 0.7rem" }}>
      {label}
    </Link>
  );

  return (
    <>
      <h1>ตรวจสอบการทำงาน / ป้องกันทุจริต</h1>
      <p className="muted">
        สรุปการกระทำที่อ่อนไหวต่อผู้ใช้ในช่วงเวลา + ธงเตือนความผิดปกติ — ข้อมูลจาก Audit Log
        (ดูรายละเอียดทีละรายการที่ <Link href="/admin/audit">Audit Log</Link>)
      </p>

      <div className="card">
        <form className="row" method="get" style={{ alignItems: "flex-end" }}>
          <div>
            <label htmlFor="from">ตั้งแต่</label>
            <input id="from" name="from" type="date" defaultValue={fromYMD} />
          </div>
          <div>
            <label htmlFor="to">ถึง</label>
            <input id="to" name="to" type="date" defaultValue={toYMD} />
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <button type="submit">ดู</button>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            {preset("วันนี้", today, today)}
            {preset("7 วัน", ymdAddDays(today, -6), today)}
            {preset("30 วัน", ymdAddDays(today, -29), today)}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>สรุปต่อผู้ใช้ ({fromYMD} – {toYMD})</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>ผู้ใช้</th>
                <th className="num">ล็อกอิน</th>
                <th className="num">ล็อกอินล้มเหลว</th>
                <th className="num">ฝาก (ครั้ง)</th>
                <th className="num">ยอดฝาก manual</th>
                <th className="num">โบนัส (ครั้ง)</th>
                <th className="num">ยอดโบนัส</th>
                <th className="num">เปลี่ยนสถานะ</th>
                <th className="num">ตั้งห้ามโทร</th>
                <th className="num">เก็บลูกค้า</th>
                <th className="num">รีเซ็ตรหัส</th>
                <th>ธงเตือน</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="muted" style={{ textAlign: "center" }}>
                    ไม่มีกิจกรรมในช่วงนี้
                  </td>
                </tr>
              )}
              {rows.map((a) => (
                <tr key={a.name} style={a.flags.length ? { background: "#fff7ed" } : undefined}>
                  <td>{a.name}</td>
                  <td className="num">{a.logins || "-"}</td>
                  <td className="num" style={a.failedLogins >= MANY_FAILED_LOGINS ? { color: "#b91c1c", fontWeight: 700 } : undefined}>
                    {a.failedLogins || "-"}
                  </td>
                  <td className="num">{a.deposits || "-"}</td>
                  <td className="num">{a.depositSum ? formatMoney(a.depositSum) : "-"}</td>
                  <td className="num">{a.bonuses || "-"}</td>
                  <td className="num">{a.bonusSum ? formatMoney(a.bonusSum) : "-"}</td>
                  <td className="num">{a.statusChanges || "-"}</td>
                  <td className="num">{a.dncSet || "-"}</td>
                  <td className="num">{a.archives || "-"}</td>
                  <td className="num">{a.resets || "-"}</td>
                  <td>
                    {a.flags.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      a.flags.map((f, i) => (
                        <span key={i} className="badge red" style={{ display: "inline-block", marginBottom: 2 }}>
                          🚩 {f}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>รายการตั้งวันที่ย้อนหลัง/ล่วงหน้า ({suspicious.length})</h2>
        <p className="muted">การบันทึกยอดฝาก/โบนัสที่ระบุวันที่ต่างจากวันที่บันทึกจริง — ควรตรวจสอบเหตุผล</p>
        {suspicious.length === 0 ? (
          <p className="muted">ไม่พบ</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>เวลาบันทึก</th>
                <th>ผู้ทำ</th>
                <th>ประเภท</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {suspicious.map((s, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(s.when)}</td>
                  <td>{s.who}</td>
                  <td>{s.action}</td>
                  <td>{s.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
