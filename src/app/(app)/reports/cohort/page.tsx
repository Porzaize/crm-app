import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/labels";
import { getCohort, parseYMD, type CohortResult } from "@/lib/report";
import { buildPresets } from "@/lib/date-presets";

export const dynamic = "force-dynamic";

function pctNum(part: number, whole: number): number {
  return whole ? (part / whole) * 100 : 0;
}
function pct(part: number, whole: number): string {
  if (!whole) return "-";
  return ((part / whole) * 100).toFixed(1) + "%";
}
/** ไล่สีเขียวตาม % (heat) ให้เห็นแนวโน้มเร็ว */
function heat(p: number): React.CSSProperties {
  const a = (Math.min(Math.max(p, 0), 100) / 100) * 0.55;
  return { background: `rgba(34,197,94,${a.toFixed(2)})` };
}

function WinCell({ count, called, mature }: { count: number; called: number; mature: boolean }) {
  const p = pctNum(count, called);
  return (
    <td className="num" style={heat(p)}>
      {count.toLocaleString("th-TH")}
      <small style={{ display: "block", opacity: mature ? 0.75 : 0.45 }}>
        {called ? p.toFixed(1) + "%" : "-"}
      </small>
    </td>
  );
}

export default async function CohortPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("report.view");
  const sp = await searchParams;
  const presets = buildPresets();
  const defaultRange = presets[2]; // เดือนนี้

  const from = sp.from ?? defaultRange.from;
  const to = sp.to ?? defaultRange.to;
  const rangeOk = parseYMD(from) != null && parseYMD(to) != null && from <= to;

  let result: CohortResult | null = null;
  let error: string | null = null;
  if (rangeOk) {
    try {
      result = await getCohort(from, to);
    } catch (e) {
      error = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    }
  } else {
    error = "ช่วงวันที่ไม่ถูกต้อง — วันเริ่มต้องไม่อยู่หลังวันจบ";
  }

  const promo = result?.promoRows.find((r) => r.promo);
  const noPromo = result?.promoRows.find((r) => !r.promo);
  const diffPP =
    promo && noPromo ? pctNum(promo.ret31, promo.people) - pctNum(noPromo.ret31, noPromo.people) : 0;
  const promoNet = promo ? promo.depSum - promo.bonusSum : 0;

  const winHead = (label: string, mature: boolean) => (
    <th className="num">
      {label}
      {!mature && <span title="ยังไม่ครบกำหนด (cohort ยังไม่ครบวัน)"> ⚠️</span>}
    </th>
  );

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Cohort — โทรแล้วกลับมาฝาก</h1>
        <Link href={`/reports?from=${from}&to=${to}`} className="btn-link">
          รายงานรายเว็บ <span className="arr">→</span>
        </Link>
      </div>

      <div className="card">
        <div className="filter-tabs" style={{ marginBottom: "0.9rem" }}>
          {presets.map((p) => (
            <Link key={p.key} href={`/reports/cohort?from=${p.from}&to=${p.to}`} className={p.from === from && p.to === to ? "filter-tab active" : "filter-tab"}>
              {p.label}
            </Link>
          ))}
        </div>
        <form className="row" method="get">
          <div>
            <label htmlFor="from">วันที่โทร (เริ่ม)</label>
            <input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div>
            <label htmlFor="to">วันที่โทร (จบ)</label>
            <input id="to" name="to" type="date" defaultValue={to} />
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
            <button type="submit">ดูรายงาน</button>
          </div>
        </form>
      </div>

      {error && (
        <div className="card" style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div>
      )}

      {result && (
        <>
          {(!result.mature.d31 || !result.mature.d14) && (
            <div className="alert amber">
              ⚠️ บางช่วง cohort ยังไม่ครบกำหนด — ข้อมูลฝากมีถึง {result.dataMaxYMD ?? "-"} เท่านั้น
              คอลัมน์ที่มี ⚠️ จึงยังนับได้ไม่เต็มจำนวนวัน (อย่าตีความว่าอัตราต่ำจริง)
            </div>
          )}

          <div className="card">
            <h2>1) Conversion ตามช่วงเวลา — วันที่โทร {from} ถึง {to}</h2>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>เว็บ</th>
                    <th className="num">ลูกค้าที่โทร</th>
                    {winHead("ใน 3 วัน", result.mature.d3)}
                    {winHead("ใน 7 วัน", result.mature.d7)}
                    {winHead("ใน 14 วัน", result.mature.d14)}
                    {winHead("ใน 31 วัน", result.mature.d31)}
                    <th className="num">ยอดฝากใน 31 วัน</th>
                  </tr>
                </thead>
                <tbody>
                  {result.brandRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="num">{r.called.toLocaleString("th-TH")}</td>
                      <WinCell count={r.c3} called={r.called} mature={result.mature.d3} />
                      <WinCell count={r.c7} called={r.called} mature={result.mature.d7} />
                      <WinCell count={r.c14} called={r.called} mature={result.mature.d14} />
                      <WinCell count={r.c31} called={r.called} mature={result.mature.d31} />
                      <td className="num">{formatMoney(r.depTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td>รวม</td>
                    <td className="num">{result.brandTotal.called.toLocaleString("th-TH")}</td>
                    <WinCell count={result.brandTotal.c3} called={result.brandTotal.called} mature={result.mature.d3} />
                    <WinCell count={result.brandTotal.c7} called={result.brandTotal.called} mature={result.mature.d7} />
                    <WinCell count={result.brandTotal.c14} called={result.brandTotal.called} mature={result.mature.d14} />
                    <WinCell count={result.brandTotal.c31} called={result.brandTotal.called} mature={result.mature.d31} />
                    <td className="num">{formatMoney(result.brandTotal.depTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="muted" style={{ marginTop: "0.8rem", fontSize: "0.85rem" }}>
              นับลูกค้าจาก &quot;การโทรครั้งแรกในช่วง&quot; (1 คนนับครั้งเดียว) · วันโทร = วัน 0 (ฝากวันเดียวกันนับด้วย, ฝากก่อนวันโทรไม่นับ) · 3 ⊆ 7 ⊆ 14 ⊆ 31 · เวลาไทย
            </p>
          </div>

          {promo && noPromo && (
            <div className="card">
              <h2>2) เทียบกลุ่มที่ได้รับข้อเสนอโปร 20%</h2>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>กลุ่ม</th>
                      <th className="num">จำนวนคน</th>
                      <th className="num">กลับใน 7 วัน</th>
                      <th className="num">กลับใน 31 วัน</th>
                      <th className="num">ยอดฝากเฉลี่ย/คน</th>
                      <th className="num">โบนัสที่จ่ายรวม</th>
                      <th className="num">ยอดฝากสุทธิหลังหักโบนัส</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[promo, noPromo].map((g) => (
                      <tr key={String(g.promo)}>
                        <td>{g.promo ? "ได้รับโปร 20%" : "ไม่ได้รับโปร"}</td>
                        <td className="num">{g.people.toLocaleString("th-TH")}</td>
                        <td className="num" style={heat(pctNum(g.ret7, g.people))}>{pct(g.ret7, g.people)}</td>
                        <td className="num" style={heat(pctNum(g.ret31, g.people))}>{pct(g.ret31, g.people)}</td>
                        <td className="num">{formatMoney(g.people ? g.depSum / g.people : 0)}</td>
                        <td className="num">{formatMoney(g.bonusSum)}</td>
                        <td className="num">{formatMoney(g.depSum - g.bonusSum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ marginTop: "0.8rem", fontWeight: 600 }}>
                สรุป: กลุ่มได้รับโปรกลับมาฝากใน 31 วัน{" "}
                <span style={{ color: diffPP >= 0 ? "#16a34a" : "#b91c1c" }}>
                  {diffPP >= 0 ? "มากกว่า" : "น้อยกว่า"} {Math.abs(diffPP).toFixed(1)} percentage point
                </span>{" "}
                · ยอดฝากสุทธิหลังหักโบนัสของกลุ่มโปร = {formatMoney(promoNet)} บาท{" "}
                ({promoNet >= 0 ? "ยังคุ้ม" : "ไม่คุ้ม"})
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
