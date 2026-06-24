import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/labels";
import {
  getBrandSummary,
  getDailyTrend,
  parseYMD,
  type ReportResult,
  type DailyTrendRow,
} from "@/lib/report";
import { buildPresets } from "@/lib/date-presets";
import { ymdAddDays } from "@/lib/dates";
import PageBanner from "@/components/PageBanner";
import TrendChart from "@/components/charts/TrendChart";
import BarsH from "@/components/charts/BarsH";

export const dynamic = "force-dynamic";

function pct(part: number, whole: number): string {
  if (!whole) return "-";
  return ((part / whole) * 100).toFixed(1) + "%";
}

/** จำนวนวันในช่วง [from, to] รวมปลายทั้งสอง */
function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000) + 1;
}

/** ลูกศรเทียบช่วงก่อนหน้า — ขึ้น=เขียว ลง=แดง (ตัวชี้วัดเหล่านี้สูง=ดี) */
function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) {
    if (cur === 0) return <span className="muted">—</span>;
    return <span style={{ color: "#16a34a", fontWeight: 600 }}>▲ ใหม่</span>;
  }
  const diff = ((cur - prev) / prev) * 100;
  if (Math.abs(diff) < 0.05) return <span className="muted">▬ 0%</span>;
  const up = diff > 0;
  return (
    <span style={{ color: up ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
      {up ? "▲" : "▼"} {Math.abs(diff).toFixed(0)}%
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("report.view");
  const sp = await searchParams;
  const presets = buildPresets();
  const defaultRange = presets[0]; // สัปดาห์นี้

  const from = sp.from ?? defaultRange.from;
  const to = sp.to ?? defaultRange.to;

  const validFrom = parseYMD(from);
  const validTo = parseYMD(to);
  const rangeOk =
    validFrom != null && validTo != null && from <= to; // YYYY-MM-DD เทียบ string ได้ตรง

  // ช่วงก่อนหน้า ความยาวเท่ากัน ติดกันก่อนวันเริ่ม (เทียบ %)
  const len = rangeOk ? dayCount(from, to) : 0;
  const prevTo = rangeOk ? ymdAddDays(from, -1) : from;
  const prevFrom = rangeOk ? ymdAddDays(from, -len) : from;

  let result: ReportResult | null = null;
  let trend: DailyTrendRow[] = [];
  let prevTotal: ReportResult["total"] | null = null;
  let error: string | null = null;
  if (rangeOk) {
    try {
      const [cur, tr, prev] = await Promise.all([
        getBrandSummary(from, to),
        getDailyTrend(from, to),
        getBrandSummary(prevFrom, prevTo),
      ]);
      result = cur;
      trend = tr;
      prevTotal = prev.total;
    } catch (e) {
      error = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    }
  } else {
    error = "ช่วงวันที่ไม่ถูกต้อง — วันเริ่มต้องไม่อยู่หลังวันจบ";
  }

  const total = result?.total;
  const moneyFmt = (v: number) => formatMoney(v);
  const pctFmt = (v: number) => v.toFixed(1) + "%";
  const answerRatePts = trend.map((d) => ({
    ymd: d.ymd,
    value: d.calls > 0 ? (d.answered / d.calls) * 100 : 0,
  }));
  // leaderboard ต่อเว็บ (เรียงมาก→น้อย)
  const depByBrand = result
    ? [...result.rows].sort((a, b) => b.depositTotal - a.depositTotal).map((r) => ({ label: r.name, value: r.depositTotal }))
    : [];
  const callsByBrand = result
    ? [...result.rows].sort((a, b) => b.calls - a.calls).map((r) => ({ label: r.name, value: r.calls }))
    : [];

  return (
    <>
      <PageBanner title="รายงานสรุป" subtitle="ภาพรวมผลการติดตามลูกค้าตามช่วงเวลา">
        <Link href={`/reports/agents?from=${from}&to=${to}`} className="btn-secondary">
          ผลงานพนักงาน →
        </Link>
        <Link href={`/reports/cohort?from=${from}&to=${to}`} className="btn-secondary">
          Cohort →
        </Link>
      </PageBanner>

      <div className="card">
        <div className="toolbar" style={{ flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.8rem" }}>
          {presets.map((p) => (
            <Link
              key={p.key}
              href={`/reports?from=${p.from}&to=${p.to}`}
              className="btn-secondary"
              style={{ padding: "0.35rem 0.8rem" }}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form className="row" method="get">
          <div>
            <label htmlFor="from">วันที่เริ่ม</label>
            <input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div>
            <label htmlFor="to">วันที่จบ</label>
            <input id="to" name="to" type="date" defaultValue={to} />
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <button type="submit">ดูรายงาน</button>
          </div>
        </form>
      </div>

      {error && (
        <div className="card" style={{ color: "#b91c1c", fontWeight: 600 }}>
          {error}
        </div>
      )}

      {result && total && prevTotal && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>เทียบกับช่วงก่อนหน้า</h2>
          <p className="muted" style={{ marginTop: "-0.4rem", fontSize: "0.85rem" }}>
            ช่วงก่อน = {len} วันก่อนหน้า ({prevFrom} ถึง {prevTo})
          </p>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>ตัวชี้วัด</th>
                  <th className="num">ช่วงนี้</th>
                  <th className="num">ช่วงก่อน</th>
                  <th className="num">เปลี่ยนแปลง</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>โทรติดตาม</td>
                  <td className="num">{total.calls.toLocaleString("th-TH")}</td>
                  <td className="num">{prevTotal.calls.toLocaleString("th-TH")}</td>
                  <td className="num"><Delta cur={total.calls} prev={prevTotal.calls} /></td>
                </tr>
                <tr>
                  <td>รับสาย</td>
                  <td className="num">{total.answered.toLocaleString("th-TH")} ({pct(total.answered, total.calls)})</td>
                  <td className="num">{prevTotal.answered.toLocaleString("th-TH")} ({pct(prevTotal.answered, prevTotal.calls)})</td>
                  <td className="num"><Delta cur={total.answered} prev={prevTotal.answered} /></td>
                </tr>
                <tr>
                  <td>กลับมาฝาก (คน)</td>
                  <td className="num">{total.depositors.toLocaleString("th-TH")}</td>
                  <td className="num">{prevTotal.depositors.toLocaleString("th-TH")}</td>
                  <td className="num"><Delta cur={total.depositors} prev={prevTotal.depositors} /></td>
                </tr>
                <tr>
                  <td>ยอดกลับมาฝาก</td>
                  <td className="num">{formatMoney(total.depositTotal)}</td>
                  <td className="num">{formatMoney(prevTotal.depositTotal)}</td>
                  <td className="num"><Delta cur={total.depositTotal} prev={prevTotal.depositTotal} /></td>
                </tr>
                <tr>
                  <td>ยอดโบนัส</td>
                  <td className="num">{formatMoney(total.bonusTotal)}</td>
                  <td className="num">{formatMoney(prevTotal.bonusTotal)}</td>
                  <td className="num"><Delta cur={total.bonusTotal} prev={prevTotal.bonusTotal} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && total && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>กราฟแนวโน้ม {from} ถึง {to}</h2>
          <div className="chart-grid">
            <div className="chart-box">
              <h3>ยอดกลับมาฝากรายวัน</h3>
              <p className="chart-sub">รวมทุกเว็บ · เลื่อนเมาส์ที่จุดเพื่อดูค่ารายวัน</p>
              <TrendChart points={trend.map((d) => ({ ymd: d.ymd, value: d.depositTotal }))} format={moneyFmt} color="#16a34a" />
            </div>
            <div className="chart-box">
              <h3>อัตรารับสายรายวัน</h3>
              <p className="chart-sub">รับสาย ÷ โทรติดตาม (วันไทย)</p>
              <TrendChart points={answerRatePts} format={pctFmt} color="#4f46e5" fill={false} />
            </div>
            <div className="chart-box">
              <h3>ยอดกลับมาฝากต่อเว็บ</h3>
              <p className="chart-sub">เรียงมากไปน้อย</p>
              <BarsH data={depByBrand} format={moneyFmt} color="#16a34a" />
            </div>
            <div className="chart-box">
              <h3>โทรติดตามต่อเว็บ</h3>
              <p className="chart-sub">เรียงมากไปน้อย</p>
              <BarsH data={callsByBrand} format={(v) => v.toLocaleString("th-TH")} color="#4f46e5" />
            </div>
          </div>
        </div>
      )}

      {result && total && (
        <div className="card">
          <div
            className="toolbar"
            style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}
          >
            <h2 style={{ margin: 0 }}>
              สรุปผลติดตามลูกค้า {from} ถึง {to}
            </h2>
            <a
              href={`/api/reports/export?from=${from}&to=${to}`}
              className="btn-secondary"
              style={{ padding: "0.4rem 0.9rem", flex: "0 0 auto" }}
            >
              ⬇ Export Excel
            </a>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>เว็บ</th>
                  <th className="num">โทรติดตาม</th>
                  <th className="num">รับสาย</th>
                  <th className="num">รับสาย %</th>
                  <th className="num">ไม่รับสาย</th>
                  <th className="num">ไม่รับสาย %</th>
                  <th className="num">กลับมาฝาก (คน)</th>
                  <th className="num">ยอดกลับมาฝาก</th>
                  <th className="num">ยอดโบนัส</th>
                  <th className="num">โบนัส/ยอดฝาก %</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="num">{r.calls.toLocaleString("th-TH")}</td>
                    <td className="num">{r.answered.toLocaleString("th-TH")}</td>
                    <td className="num">{pct(r.answered, r.calls)}</td>
                    <td className="num">{r.noAnswer.toLocaleString("th-TH")}</td>
                    <td className="num">{pct(r.noAnswer, r.calls)}</td>
                    <td className="num">{r.depositors.toLocaleString("th-TH")}</td>
                    <td className="num">{formatMoney(r.depositTotal)}</td>
                    <td className="num">{formatMoney(r.bonusTotal)}</td>
                    <td className="num">{pct(r.bonusTotal, r.depositTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td>รวม</td>
                  <td className="num">{total.calls.toLocaleString("th-TH")}</td>
                  <td className="num">{total.answered.toLocaleString("th-TH")}</td>
                  <td className="num">{pct(total.answered, total.calls)}</td>
                  <td className="num">{total.noAnswer.toLocaleString("th-TH")}</td>
                  <td className="num">{pct(total.noAnswer, total.calls)}</td>
                  <td className="num">{total.depositors.toLocaleString("th-TH")}</td>
                  <td className="num">{formatMoney(total.depositTotal)}</td>
                  <td className="num">{formatMoney(total.bonusTotal)}</td>
                  <td className="num">{pct(total.bonusTotal, total.depositTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted" style={{ marginTop: "0.8rem", fontSize: "0.85rem" }}>
            หมายเหตุ: &quot;รับสาย&quot; นับ รับสาย + รับแล้วตัดสาย + รับแล้วเงียบ (ตรงกับนิยามในแดชบอร์ด) ·
            ช่วงวันที่คิดตามเวลาไทย
          </p>
        </div>
      )}
    </>
  );
}
