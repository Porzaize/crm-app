import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/labels";
import {
  getAgentSummary,
  getAgentDaily,
  parseYMD,
  type AgentResult,
  type AgentRow,
} from "@/lib/report";
import { buildPresets } from "@/lib/date-presets";
import BarsH from "@/components/charts/BarsH";

export const dynamic = "force-dynamic";

function pct(part: number, whole: number): string {
  if (!whole) return "-";
  return ((part / whole) * 100).toFixed(1) + "%";
}

type Sort = "calls" | "deposit" | "answered";
const SORTS: { key: Sort; label: string }[] = [
  { key: "calls", label: "จำนวนโทร" },
  { key: "answered", label: "รับสาย" },
  { key: "deposit", label: "ยอดฝากที่ตามกลับ" },
];

function sortRows(rows: AgentRow[], sort: Sort): AgentRow[] {
  const key: keyof AgentRow = sort === "deposit" ? "depositTotal" : sort;
  return [...rows].sort((a, b) => (b[key] as number) - (a[key] as number));
}

export default async function AgentReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; sort?: string; caller?: string }>;
}) {
  await requirePermission("report.view");
  const sp = await searchParams;
  const presets = buildPresets();
  const defaultRange = presets[2]; // เดือนนี้

  const from = sp.from ?? defaultRange.from;
  const to = sp.to ?? defaultRange.to;
  const sort: Sort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as Sort) : "calls";

  const rangeOk = parseYMD(from) != null && parseYMD(to) != null && from <= to;

  let result: AgentResult | null = null;
  let error: string | null = null;
  if (rangeOk) {
    try {
      result = await getAgentSummary(from, to);
    } catch (e) {
      error = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    }
  } else {
    error = "ช่วงวันที่ไม่ถูกต้อง — วันเริ่มต้องไม่อยู่หลังวันจบ";
  }

  const rows = result ? sortRows(result.rows, sort) : [];
  const total = result?.total;

  // รายละเอียดรายวันของผู้โทรที่เลือก
  const callerSel = sp.caller;
  let dailyCallerId: number | null | undefined;
  if (callerSel === "imported") dailyCallerId = null;
  else if (callerSel && /^\d+$/.test(callerSel)) dailyCallerId = Number(callerSel);
  const selectedRow =
    dailyCallerId !== undefined
      ? rows.find((r) => r.callerId === dailyCallerId)
      : undefined;
  const daily = selectedRow ? await getAgentDaily(dailyCallerId!, from, to) : null;

  const href = (o: { sort?: Sort; caller?: string | null }) => {
    const u = new URLSearchParams();
    u.set("from", from);
    u.set("to", to);
    u.set("sort", o.sort ?? sort);
    const c = o.caller === undefined ? callerSel : o.caller;
    if (c) u.set("caller", c);
    return `/reports/agents?${u.toString()}`;
  };
  const callerKey = (r: AgentRow) => (r.callerId == null ? "imported" : String(r.callerId));

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>ผลงานรายพนักงาน</h1>
        <Link href={`/reports?from=${from}&to=${to}`} className="btn-link">
          รายงานรายเว็บ <span className="arr">→</span>
        </Link>
      </div>

      <div className="card">
        <div className="toolbar" style={{ flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.8rem" }}>
          {presets.map((p) => (
            <Link
              key={p.key}
              href={`/reports/agents?from=${p.from}&to=${p.to}&sort=${sort}`}
              className="btn-secondary"
              style={{ padding: "0.35rem 0.8rem" }}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form className="row" method="get">
          <input type="hidden" name="sort" value={sort} />
          <div>
            <label htmlFor="from">วันที่เริ่ม</label>
            <input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div>
            <label htmlFor="to">วันที่จบ</label>
            <input id="to" name="to" type="date" defaultValue={to} />
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
            <button type="submit">ดูรายงาน</button>
          </div>
        </form>
      </div>

      {error && (
        <div className="card" style={{ color: "#b91c1c", fontWeight: 600 }}>
          {error}
        </div>
      )}

      {result && total && (
        <div className="card">
          <div className="toolbar" style={{ flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>
              ผลงาน {from} ถึง {to}
            </h2>
            <span className="muted" style={{ marginLeft: "auto" }}>เรียงตาม:</span>
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={href({ sort: s.key })}
                className={sort === s.key ? "btn-primary" : "btn-secondary"}
                style={{ padding: "0.3rem 0.7rem", fontSize: "0.85rem" }}
              >
                {s.label}
              </Link>
            ))}
          </div>
          <div className="chart-box" style={{ margin: "0.8rem 0" }}>
            <h3>
              Leaderboard —{" "}
              {sort === "deposit" ? "ยอดฝากที่ตามกลับ" : sort === "answered" ? "รับสาย" : "จำนวนโทร"}
            </h3>
            <p className="chart-sub">เรียงตามที่เลือกด้านบน</p>
            <BarsH
              data={rows.map((r) => ({
                label: r.name,
                value: sort === "deposit" ? r.depositTotal : sort === "answered" ? r.answered : r.calls,
              }))}
              format={sort === "deposit" ? formatMoney : (v) => v.toLocaleString("th-TH")}
              color={sort === "deposit" ? "#16a34a" : "#4f46e5"}
            />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th className="num">โทร</th>
                  <th className="num">รับสาย</th>
                  <th className="num">รับสาย %</th>
                  <th className="num">SMS</th>
                  <th className="num">เสนอโปร 20%</th>
                  <th className="num">กลับมาฝาก (คน)</th>
                  <th className="num">ยอดฝากที่ตามกลับ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={callerKey(r)}>
                    <td>
                      <Link href={href({ caller: callerKey(r) })}>{r.name}</Link>
                    </td>
                    <td className="num">{r.calls.toLocaleString("th-TH")}</td>
                    <td className="num">{r.answered.toLocaleString("th-TH")}</td>
                    <td className="num">{pct(r.answered, r.calls)}</td>
                    <td className="num">{r.sms.toLocaleString("th-TH")}</td>
                    <td className="num">{r.promo.toLocaleString("th-TH")}</td>
                    <td className="num">{r.depositors.toLocaleString("th-TH")}</td>
                    <td className="num">{formatMoney(r.depositTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td>รวม</td>
                  <td className="num">{total.calls.toLocaleString("th-TH")}</td>
                  <td className="num">{total.answered.toLocaleString("th-TH")}</td>
                  <td className="num">{pct(total.answered, total.calls)}</td>
                  <td className="num">{total.sms.toLocaleString("th-TH")}</td>
                  <td className="num">{total.promo.toLocaleString("th-TH")}</td>
                  <td className="num">{total.depositors.toLocaleString("th-TH")}</td>
                  <td className="num">{formatMoney(total.depositTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted" style={{ marginTop: "0.8rem", fontSize: "0.85rem" }}>
            หมายเหตุ: &quot;กลับมาฝาก&quot; ให้เครดิตผู้โทรล่าสุด (ในช่วง) ที่โทรก่อน/วันเดียวกับวันฝาก —
            1 ยอดฝากนับให้ผู้รับเครดิตคนเดียว · แถว &quot;{rows.find((r) => r.callerId == null)?.name ?? "นำเข้า"}&quot; คือสายที่ไม่มีผู้บันทึก (import) · เวลาไทย
          </p>
        </div>
      )}

      {selectedRow && daily && (
        <div className="card">
          <h2>
            รายละเอียดรายวัน: {selectedRow.name}
          </h2>
          {daily.length === 0 ? (
            <p className="muted">ไม่มีการโทรในช่วงนี้</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>วันที่ (ไทย)</th>
                    <th className="num">โทร</th>
                    <th className="num">รับสาย</th>
                    <th className="num">รับสาย %</th>
                    <th className="num">SMS</th>
                    <th className="num">เสนอโปร 20%</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.ymd}>
                      <td>{d.ymd}</td>
                      <td className="num">{d.calls.toLocaleString("th-TH")}</td>
                      <td className="num">{d.answered.toLocaleString("th-TH")}</td>
                      <td className="num">{pct(d.answered, d.calls)}</td>
                      <td className="num">{d.sms.toLocaleString("th-TH")}</td>
                      <td className="num">{d.promo.toLocaleString("th-TH")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
