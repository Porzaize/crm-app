import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { formatMoney } from "@/lib/labels";
import { bangkokDayStart, bangkokNextDayStart } from "@/lib/dates";
import { DAILY_CALL_TARGET } from "@/lib/constants";
import ProgressBar from "@/components/ProgressBar";
import PageBanner from "@/components/PageBanner";

export const dynamic = "force-dynamic";

type BrandRow = {
  id: number;
  name: string;
  customers: number;
  calls: number;
  answered: number;
  depositors: number;
  deposit_total: number;
  bonus_total: number;
};

async function brandSummary(): Promise<BrandRow[]> {
  const calls = await prisma.$queryRaw<
    { id: number; name: string; customers: bigint; calls: bigint; answered: bigint }[]
  >`
    SELECT b.id, b.name,
      COUNT(DISTINCT c.id)::bigint AS customers,
      COUNT(cl.id)::bigint AS calls,
      COUNT(cl.id) FILTER (
        WHERE cl.outcome IN ('ANSWERED','ANSWERED_HUNG_UP','ANSWERED_SILENT')
      )::bigint AS answered
    FROM "Brand" b
    LEFT JOIN "Customer" c ON c."brandId" = b.id AND c.archived = false
    LEFT JOIN "CampaignContact" cc ON cc."customerId" = c.id
    LEFT JOIN "CallLog" cl ON cl."contactId" = cc.id
    GROUP BY b.id, b.name
    ORDER BY b.name`;

  const deposits = await prisma.$queryRaw<
    { id: number; depositors: bigint; deposit_total: number }[]
  >`
    SELECT b.id,
      COUNT(DISTINCT d."customerId")::bigint AS depositors,
      COALESCE(SUM(d.amount), 0) AS deposit_total
    FROM "Brand" b
    LEFT JOIN "Customer" c ON c."brandId" = b.id AND c.archived = false
    LEFT JOIN "DepositEvent" d ON d."customerId" = c.id
    GROUP BY b.id`;

  const bonuses = await prisma.$queryRaw<{ id: number; bonus_total: number }[]>`
    SELECT b.id, COALESCE(SUM(ba.amount), 0) AS bonus_total
    FROM "Brand" b
    LEFT JOIN "Customer" c ON c."brandId" = b.id AND c.archived = false
    LEFT JOIN "BonusAdjustment" ba ON ba."customerId" = c.id
    GROUP BY b.id`;

  const depMap = new Map(deposits.map((d) => [d.id, d]));
  const bonMap = new Map(bonuses.map((b) => [b.id, b]));

  return calls.map((c) => ({
    id: c.id,
    name: c.name,
    customers: Number(c.customers),
    calls: Number(c.calls),
    answered: Number(c.answered),
    depositors: Number(depMap.get(c.id)?.depositors ?? 0),
    deposit_total: Number(depMap.get(c.id)?.deposit_total ?? 0),
    bonus_total: Number(bonMap.get(c.id)?.bonus_total ?? 0),
  }));
}

function pct(part: number, whole: number): string {
  if (!whole) return "-";
  return ((part / whole) * 100).toFixed(1) + "%";
}

export default async function DashboardPage() {
  const session = await requireSession();
  const rows = await brandSummary();

  const now = new Date();
  const assignFilter = session.role === "AGENT" ? { assignedToId: session.userId } : {};
  const [lapsed, doNotCall, pendingToday, dueCallbacks] = await Promise.all([
    prisma.customer.count({ where: { status: "LAPSED", archived: false } }),
    prisma.customer.count({ where: { status: "DO_NOT_CALL", archived: false } }),
    prisma.campaignContact.count({
      where: { status: "PENDING", ...assignFilter },
    }),
    // นัดโทรที่ถึงกำหนดแล้ว (มีนัดและเลยเวลาแล้ว) — ไม่นับลีดใหม่ที่ยังไม่มีนัด
    prisma.campaignContact.count({
      where: { status: "PENDING", nextCallAt: { lte: now }, ...assignFilter },
    }),
  ]);

  // ===== เป้าโทรรายวัน (ข้อ Tier 2) =====
  const todayStart = bangkokDayStart(now);
  const tomorrowStart = bangkokNextDayStart(now);
  const isAgent = session.role === "AGENT";

  // พนักงาน: นับสายที่ตัวเองโทรวันนี้ ; หัวหน้า/แอดมิน: สรุปรายคน
  const myCallsToday = isAgent
    ? await prisma.callLog.count({
        where: { callerId: session.userId, calledAt: { gte: todayStart, lt: tomorrowStart } },
      })
    : 0;

  const agentProgress = isAgent
    ? []
    : await (async () => {
        const [agents, grouped] = await Promise.all([
          prisma.user.findMany({
            where: { active: true, role: "AGENT" },
            orderBy: { displayName: "asc" },
            select: { id: true, displayName: true },
          }),
          prisma.callLog.groupBy({
            by: ["callerId"],
            where: { callerId: { not: null }, calledAt: { gte: todayStart, lt: tomorrowStart } },
            _count: { _all: true },
          }),
        ]);
        const byId = new Map(grouped.map((g) => [g.callerId, g._count._all]));
        return agents.map((a) => ({ id: a.id, name: a.displayName, calls: byId.get(a.id) ?? 0 }));
      })();

  const total = rows.reduce(
    (a, r) => ({
      customers: a.customers + r.customers,
      calls: a.calls + r.calls,
      answered: a.answered + r.answered,
      depositors: a.depositors + r.depositors,
      deposit_total: a.deposit_total + r.deposit_total,
      bonus_total: a.bonus_total + r.bonus_total,
    }),
    { customers: 0, calls: 0, answered: 0, depositors: 0, deposit_total: 0, bonus_total: 0 }
  );

  return (
    <>
      <PageBanner title="แดชบอร์ด" subtitle="ภาพรวมการติดตามลูกค้า ยอดโทร และยอดกลับมาฝาก" />

      <div className="card-grid">
        <div className="card stat">
          <div className="label">ลูกค้าทั้งหมด</div>
          <div className="value">{total.customers.toLocaleString("th-TH")}</div>
        </div>
        <div className="card stat">
          <div className="label">ขาดฝาก (รอติดตาม)</div>
          <div className="value">{lapsed.toLocaleString("th-TH")}</div>
        </div>
        <div className="card stat">
          <div className="label">{session.role === "AGENT" ? "คิวของฉัน (รอโทร)" : "คิวรอโทรทั้งหมด"}</div>
          <div className="value">{pendingToday.toLocaleString("th-TH")}</div>
        </div>
        <div className="card stat">
          <div className="label">นัดโทรถึงกำหนด</div>
          <div className="value" style={dueCallbacks > 0 ? { color: "var(--amber, #b45309)" } : undefined}>
            {dueCallbacks.toLocaleString("th-TH")}
          </div>
        </div>
        <div className="card stat">
          <div className="label">ห้ามโทร</div>
          <div className="value">{doNotCall.toLocaleString("th-TH")}</div>
        </div>
        <div className="card stat">
          <div className="label">โทรไปแล้ว (สาย)</div>
          <div className="value">{total.calls.toLocaleString("th-TH")}</div>
        </div>
        <div className="card stat">
          <div className="label">รับสาย</div>
          <div className="value">{pct(total.answered, total.calls)}</div>
        </div>
        <div className="card stat">
          <div className="label">กลับมาฝาก (คน)</div>
          <div className="value">{total.depositors.toLocaleString("th-TH")}</div>
        </div>
        <div className="card stat">
          <div className="label">ยอดกลับมาฝากรวม (บาท)</div>
          <div className="value">{formatMoney(total.deposit_total)}</div>
        </div>
      </div>

      {isAgent && (
        <div className="card">
          <h2>เป้าโทรวันนี้</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, whiteSpace: "nowrap" }}>
              {myCallsToday.toLocaleString("th-TH")}
              <span className="muted" style={{ fontSize: "1rem", fontWeight: 400 }}> / {DAILY_CALL_TARGET} สาย</span>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <ProgressBar value={myCallsToday} max={DAILY_CALL_TARGET} />
            </div>
            <div style={{ whiteSpace: "nowrap" }}>
              {myCallsToday >= DAILY_CALL_TARGET ? (
                <span className="badge green">ถึงเป้าแล้ว 🎉</span>
              ) : (
                <span className="muted">เหลืออีก {(DAILY_CALL_TARGET - myCallsToday).toLocaleString("th-TH")} สาย</span>
              )}
            </div>
          </div>
        </div>
      )}

      {!isAgent && (
        <div className="card">
          <h2>เป้าโทรวันนี้ (รายคน · เป้า {DAILY_CALL_TARGET} สาย)</h2>
          {agentProgress.length === 0 ? (
            <p className="muted">ยังไม่มีพนักงาน</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>พนักงาน</th>
                    <th className="num">โทรแล้ว</th>
                    <th style={{ width: "45%" }}>ความคืบหน้า</th>
                  </tr>
                </thead>
                <tbody>
                  {agentProgress.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {a.calls.toLocaleString("th-TH")}
                        {a.calls >= DAILY_CALL_TARGET && " ✅"}
                      </td>
                      <td>
                        <ProgressBar value={a.calls} max={DAILY_CALL_TARGET} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>สรุปรายเว็บ</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>เว็บ</th>
                <th className="num">ลูกค้า</th>
                <th className="num">โทร</th>
                <th className="num">รับสาย</th>
                <th className="num">รับสาย %</th>
                <th className="num">กลับมาฝาก (คน)</th>
                <th className="num">ยอดฝากรวม</th>
                <th className="num">โบนัสรวม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="num">{r.customers.toLocaleString("th-TH")}</td>
                  <td className="num">{r.calls.toLocaleString("th-TH")}</td>
                  <td className="num">{r.answered.toLocaleString("th-TH")}</td>
                  <td className="num">{pct(r.answered, r.calls)}</td>
                  <td className="num">{r.depositors.toLocaleString("th-TH")}</td>
                  <td className="num">{formatMoney(r.deposit_total)}</td>
                  <td className="num">{formatMoney(r.bonus_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>รวม</td>
                <td className="num">{total.customers.toLocaleString("th-TH")}</td>
                <td className="num">{total.calls.toLocaleString("th-TH")}</td>
                <td className="num">{total.answered.toLocaleString("th-TH")}</td>
                <td className="num">{pct(total.answered, total.calls)}</td>
                <td className="num">{total.depositors.toLocaleString("th-TH")}</td>
                <td className="num">{formatMoney(total.deposit_total)}</td>
                <td className="num">{formatMoney(total.bonus_total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
