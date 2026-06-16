import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ANSWERED_OUTCOMES } from "@/lib/labels";
import { bangkokDateTime, dateOnlyUTC, ymdAddDays } from "@/lib/dates";

// Logic กลางของรายงานสรุปผลติดตามลูกค้า (ข้อ 4)
// ใช้ร่วมกันระหว่างหน้าเว็บ /reports และ API export Excel (ข้อ 5) — ห้าม copy query ซ้ำ

export type ReportRow = {
  id: number;
  name: string;
  calls: number; // จำนวนโทรติดตามในช่วง
  answered: number; // รับสาย (ANSWERED_OUTCOMES)
  noAnswer: number; // ไม่รับสาย = calls - answered
  depositors: number; // ลูกค้า distinct ที่กลับมาฝาก (amount > 0)
  depositTotal: number; // ยอดกลับมาฝากรวม
  bonusTotal: number; // ยอดโบนัสที่เติม
};

export type ReportTotals = Omit<ReportRow, "id" | "name">;

export type ReportResult = {
  fromYMD: string;
  toYMD: string;
  rows: ReportRow[];
  total: ReportTotals;
};

type YMD = { y: number; m: number; d: number };

export function parseYMD(s: string | undefined | null): YMD | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

const DAY_MS = 24 * 60 * 60 * 1000;

type RangeBounds = { callFrom: Date; callToExcl: Date; dateFrom: Date; dateToExcl: Date };

/** ขอบช่วงวันที่ (วันไทย): CallLog ใช้ขอบเวลาไทย, Deposit/Bonus ใช้ date-only UTC midnight */
function rangeBounds(fromYMD: string, toYMD: string): RangeBounds {
  const f = parseYMD(fromYMD);
  const t = parseYMD(toYMD);
  if (!f || !t) throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
  const callFrom = bangkokDateTime(f.y, f.m, f.d, 0, 0);
  const callToExcl = new Date(bangkokDateTime(t.y, t.m, t.d, 0, 0).getTime() + DAY_MS);
  const dateFrom = dateOnlyUTC(f.y, f.m, f.d);
  const dateToExcl = new Date(dateOnlyUTC(t.y, t.m, t.d).getTime() + DAY_MS);
  if (callToExcl.getTime() <= callFrom.getTime()) {
    throw new Error("วันเริ่มต้องไม่อยู่หลังวันจบ");
  }
  return { callFrom, callToExcl, dateFrom, dateToExcl };
}

/**
 * สรุปผลติดตามต่อเว็บ ในช่วง [fromYMD, toYMD] (วันไทย, รวมปลายทั้งสองข้าง)
 * โยน Error ถ้ารูปแบบวันที่ผิดหรือวันเริ่มอยู่หลังวันจบ
 */
export async function getBrandSummary(
  fromYMD: string,
  toYMD: string
): Promise<ReportResult> {
  const f = parseYMD(fromYMD);
  const t = parseYMD(toYMD);
  if (!f || !t) throw new Error("รูปแบบวันที่ไม่ถูกต้อง");

  // CallLog.calledAt เป็น timestamp -> ใช้ขอบเวลาไทย (00:00 วันเริ่ม ถึง 00:00 วันถัดจากวันจบ)
  const callFrom = bangkokDateTime(f.y, f.m, f.d, 0, 0);
  const callToExcl = new Date(bangkokDateTime(t.y, t.m, t.d, 0, 0).getTime() + DAY_MS);
  // DepositEvent.date / BonusAdjustment.date เป็น date-only (UTC midnight ของวันไทย)
  const dateFrom = dateOnlyUTC(f.y, f.m, f.d);
  const dateToExcl = new Date(dateOnlyUTC(t.y, t.m, t.d).getTime() + DAY_MS);

  if (callToExcl.getTime() <= callFrom.getTime()) {
    throw new Error("วันเริ่มต้องไม่อยู่หลังวันจบ");
  }

  // outcome เป็น enum — cast เป็น text ก่อนเทียบกับพารามิเตอร์ (เลี่ยง type error)
  const calls = await prisma.$queryRaw<
    { id: number; name: string; calls: bigint; answered: bigint }[]
  >`
    SELECT b.id, b.name,
      COUNT(cl.id)::bigint AS calls,
      COUNT(cl.id) FILTER (
        WHERE cl.outcome::text IN (${Prisma.join(ANSWERED_OUTCOMES)})
      )::bigint AS answered
    FROM "Brand" b
    LEFT JOIN "Customer" c ON c."brandId" = b.id
    LEFT JOIN "CampaignContact" cc ON cc."customerId" = c.id
    LEFT JOIN "CallLog" cl
      ON cl."contactId" = cc.id
      AND cl."calledAt" >= ${callFrom}
      AND cl."calledAt" < ${callToExcl}
    GROUP BY b.id, b.name
    ORDER BY b.name`;

  const deposits = await prisma.$queryRaw<
    { id: number; depositors: bigint; deposit_total: number }[]
  >`
    SELECT b.id,
      COUNT(DISTINCT d."customerId")::bigint AS depositors,
      COALESCE(SUM(d.amount), 0) AS deposit_total
    FROM "Brand" b
    LEFT JOIN "Customer" c ON c."brandId" = b.id
    LEFT JOIN "DepositEvent" d
      ON d."customerId" = c.id
      AND d.amount > 0
      AND d.date >= ${dateFrom}
      AND d.date < ${dateToExcl}
    GROUP BY b.id`;

  const bonuses = await prisma.$queryRaw<{ id: number; bonus_total: number }[]>`
    SELECT b.id, COALESCE(SUM(ba.amount), 0) AS bonus_total
    FROM "Brand" b
    LEFT JOIN "Customer" c ON c."brandId" = b.id
    LEFT JOIN "BonusAdjustment" ba
      ON ba."customerId" = c.id
      AND ba.date >= ${dateFrom}
      AND ba.date < ${dateToExcl}
    GROUP BY b.id`;

  const depMap = new Map(deposits.map((d) => [d.id, d]));
  const bonMap = new Map(bonuses.map((b) => [b.id, b]));

  const rows: ReportRow[] = calls.map((c) => {
    const nCalls = Number(c.calls);
    const nAns = Number(c.answered);
    return {
      id: c.id,
      name: c.name,
      calls: nCalls,
      answered: nAns,
      noAnswer: nCalls - nAns,
      depositors: Number(depMap.get(c.id)?.depositors ?? 0),
      depositTotal: Number(depMap.get(c.id)?.deposit_total ?? 0),
      bonusTotal: Number(bonMap.get(c.id)?.bonus_total ?? 0),
    };
  });

  const total = rows.reduce<ReportTotals>(
    (a, r) => ({
      calls: a.calls + r.calls,
      answered: a.answered + r.answered,
      noAnswer: a.noAnswer + r.noAnswer,
      depositors: a.depositors + r.depositors,
      depositTotal: a.depositTotal + r.depositTotal,
      bonusTotal: a.bonusTotal + r.bonusTotal,
    }),
    { calls: 0, answered: 0, noAnswer: 0, depositors: 0, depositTotal: 0, bonusTotal: 0 }
  );

  return { fromYMD, toYMD, rows, total };
}

// ====== ข้อ 8: ผลงานรายพนักงาน ======
// นิยาม "ลูกค้ากลับมาฝาก" ของพนักงาน X = ลูกค้าที่ "การโทรครั้งล่าสุดก่อน/วันเดียวกับวันฝาก"
// (ในช่วงรายงาน) เป็นของ X — กันนับซ้ำเมื่อลูกค้าถูกโทรโดยหลายคน (1 ยอดฝาก = 1 ผู้รับเครดิต)

export type AgentRow = {
  callerId: number | null; // null = ข้อมูลนำเข้าจาก Excel (ไม่ระบุผู้โทร)
  name: string;
  calls: number;
  answered: number;
  noAnswer: number;
  sms: number;
  promo: number;
  depositors: number;
  depositTotal: number;
};

export type AgentTotals = Omit<AgentRow, "callerId" | "name">;

export type AgentResult = {
  fromYMD: string;
  toYMD: string;
  rows: AgentRow[];
  total: AgentTotals;
};

export const IMPORTED_CALLER_LABEL = "ไม่ระบุผู้โทร (นำเข้า)";

export async function getAgentSummary(fromYMD: string, toYMD: string): Promise<AgentResult> {
  const { callFrom, callToExcl, dateFrom, dateToExcl } = rangeBounds(fromYMD, toYMD);

  const calls = await prisma.$queryRaw<
    { caller_id: number | null; calls: bigint; answered: bigint; sms: bigint; promo: bigint }[]
  >`
    SELECT cl."callerId" AS caller_id,
      COUNT(*)::bigint AS calls,
      COUNT(*) FILTER (WHERE cl.outcome::text IN (${Prisma.join(ANSWERED_OUTCOMES)}))::bigint AS answered,
      COUNT(*) FILTER (WHERE cl."smsSent")::bigint AS sms,
      COUNT(*) FILTER (WHERE cl.disposition::text = 'PROMO_20')::bigint AS promo
    FROM "CallLog" cl
    WHERE cl."calledAt" >= ${callFrom} AND cl."calledAt" < ${callToExcl}
    GROUP BY cl."callerId"`;

  // ยอดฝากใน "ช่วง" → ให้เครดิตผู้โทรล่าสุด (ในช่วง) ที่โทรในวันหรือก่อนวันฝาก
  const deps = await prisma.$queryRaw<
    { caller_id: number | null; depositors: bigint; deposit_total: number }[]
  >`
    WITH dep AS (
      SELECT d.id, d."customerId" AS customer_id, d.amount, d.date
      FROM "DepositEvent" d
      WHERE d.amount > 0 AND d.date >= ${dateFrom} AND d.date < ${dateToExcl}
    ),
    attributed AS (
      SELECT dep.amount, dep.customer_id, lc.call_id, lc.caller_id
      FROM dep
      LEFT JOIN LATERAL (
        SELECT cl.id AS call_id, cl."callerId" AS caller_id
        FROM "CallLog" cl
        JOIN "CampaignContact" cc ON cl."contactId" = cc.id
        WHERE cc."customerId" = dep.customer_id
          AND cl."calledAt" >= ${callFrom} AND cl."calledAt" < ${callToExcl}
          AND (cl."calledAt" AT TIME ZONE 'Asia/Bangkok')::date <= dep.date::date
        ORDER BY cl."calledAt" DESC, cl.id DESC
        LIMIT 1
      ) lc ON true
    )
    SELECT caller_id,
      COUNT(DISTINCT customer_id)::bigint AS depositors,
      COALESCE(SUM(amount), 0) AS deposit_total
    FROM attributed
    WHERE call_id IS NOT NULL  -- มีสายก่อน/วันเดียวกับวันฝาก (caller_id null = สายนำเข้า ก็ให้เครดิตแถวนำเข้า)
    GROUP BY caller_id`;

  const users = await prisma.user.findMany({ select: { id: true, displayName: true } });
  const nameById = new Map(users.map((u) => [u.id, u.displayName]));
  const depByCaller = new Map(deps.map((d) => [d.caller_id, d]));

  const rows: AgentRow[] = calls.map((c) => {
    const nCalls = Number(c.calls);
    const nAns = Number(c.answered);
    const d = depByCaller.get(c.caller_id);
    return {
      callerId: c.caller_id,
      name: c.caller_id == null ? IMPORTED_CALLER_LABEL : nameById.get(c.caller_id) ?? `#${c.caller_id}`,
      calls: nCalls,
      answered: nAns,
      noAnswer: nCalls - nAns,
      sms: Number(c.sms),
      promo: Number(c.promo),
      depositors: Number(d?.depositors ?? 0),
      depositTotal: Number(d?.deposit_total ?? 0),
    };
  });

  const total = rows.reduce<AgentTotals>(
    (a, r) => ({
      calls: a.calls + r.calls,
      answered: a.answered + r.answered,
      noAnswer: a.noAnswer + r.noAnswer,
      sms: a.sms + r.sms,
      promo: a.promo + r.promo,
      depositors: a.depositors + r.depositors,
      depositTotal: a.depositTotal + r.depositTotal,
    }),
    { calls: 0, answered: 0, noAnswer: 0, sms: 0, promo: 0, depositors: 0, depositTotal: 0 }
  );

  return { fromYMD, toYMD, rows, total };
}

// ====== ข้อ 9: Cohort Analysis ======
// นับลูกค้าจาก "การโทรครั้งแรกในช่วง" (first call) แล้วดูว่ากลับมาฝาก (amount>0)
// ภายใน 3/7/14/31 วัน — นับวันโทรเป็นวัน 0 (ฝากวันเดียวกันหลังโทรนับด้วย), ฝากก่อนวันโทรไม่นับ
// ทุกอย่างคิดจาก query เดียว (CTE) คืน 1 แถวต่อลูกค้า แล้ว reduce ใน JS เป็น 2 ตาราง

type CohortRaw = {
  customer_id: number;
  brand_id: number;
  promo: boolean;
  r3: boolean;
  r7: boolean;
  r14: boolean;
  r31: boolean;
  dep31: number;
  bonus31: number;
};

export type CohortBrandRow = {
  id: number;
  name: string;
  called: number;
  c3: number;
  c7: number;
  c14: number;
  c31: number;
  depTotal: number;
};
export type CohortBrandTotal = Omit<CohortBrandRow, "id" | "name">;

export type CohortPromoRow = {
  promo: boolean;
  people: number;
  ret7: number;
  ret31: number;
  depSum: number;
  bonusSum: number;
};

export type CohortResult = {
  fromYMD: string;
  toYMD: string;
  dataMaxYMD: string | null;
  mature: { d3: boolean; d7: boolean; d14: boolean; d31: boolean };
  brandRows: CohortBrandRow[];
  brandTotal: CohortBrandTotal;
  promoRows: CohortPromoRow[]; // [promo=true, promo=false]
};

function addDaysYMD(ymdStr: string, n: number): string {
  const d = new Date(ymdStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function getCohort(fromYMD: string, toYMD: string): Promise<CohortResult> {
  const { callFrom, callToExcl } = rangeBounds(fromYMD, toYMD);

  const raw = await prisma.$queryRaw<CohortRaw[]>`
    WITH fc AS (
      SELECT cc."customerId" AS customer_id,
        (MIN(cl."calledAt") AT TIME ZONE 'Asia/Bangkok')::date AS call_day,
        bool_or(cl.disposition::text = 'PROMO_20') AS promo
      FROM "CallLog" cl
      JOIN "CampaignContact" cc ON cl."contactId" = cc.id
      WHERE cl."calledAt" >= ${callFrom} AND cl."calledAt" < ${callToExcl}
      GROUP BY cc."customerId"
    )
    SELECT fc.customer_id, c."brandId" AS brand_id, fc.promo,
      EXISTS(SELECT 1 FROM "DepositEvent" d WHERE d."customerId"=fc.customer_id AND d.amount>0 AND d.date::date >= fc.call_day AND d.date::date <= fc.call_day + 3) AS r3,
      EXISTS(SELECT 1 FROM "DepositEvent" d WHERE d."customerId"=fc.customer_id AND d.amount>0 AND d.date::date >= fc.call_day AND d.date::date <= fc.call_day + 7) AS r7,
      EXISTS(SELECT 1 FROM "DepositEvent" d WHERE d."customerId"=fc.customer_id AND d.amount>0 AND d.date::date >= fc.call_day AND d.date::date <= fc.call_day + 14) AS r14,
      EXISTS(SELECT 1 FROM "DepositEvent" d WHERE d."customerId"=fc.customer_id AND d.amount>0 AND d.date::date >= fc.call_day AND d.date::date <= fc.call_day + 31) AS r31,
      COALESCE((SELECT SUM(d.amount) FROM "DepositEvent" d WHERE d."customerId"=fc.customer_id AND d.amount>0 AND d.date::date >= fc.call_day AND d.date::date <= fc.call_day + 31),0) AS dep31,
      COALESCE((SELECT SUM(ba.amount) FROM "BonusAdjustment" ba WHERE ba."customerId"=fc.customer_id AND ba.date::date >= fc.call_day AND ba.date::date <= fc.call_day + 31),0) AS bonus31
    FROM fc JOIN "Customer" c ON c.id = fc.customer_id`;

  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  const byBrand = new Map<number, CohortBrandRow>(
    brands.map((b) => [b.id, { id: b.id, name: b.name, called: 0, c3: 0, c7: 0, c14: 0, c31: 0, depTotal: 0 }])
  );

  const promoAgg = { true: { people: 0, ret7: 0, ret31: 0, depSum: 0, bonusSum: 0 }, false: { people: 0, ret7: 0, ret31: 0, depSum: 0, bonusSum: 0 } };

  for (const row of raw) {
    const b = byBrand.get(row.brand_id);
    if (b) {
      b.called++;
      if (row.r3) b.c3++;
      if (row.r7) b.c7++;
      if (row.r14) b.c14++;
      if (row.r31) b.c31++;
      b.depTotal += Number(row.dep31);
    }
    const g = row.promo ? promoAgg.true : promoAgg.false;
    g.people++;
    if (row.r7) g.ret7++;
    if (row.r31) g.ret31++;
    g.depSum += Number(row.dep31);
    g.bonusSum += Number(row.bonus31);
  }

  const brandRows = [...byBrand.values()];
  const brandTotal = brandRows.reduce<CohortBrandTotal>(
    (a, r) => ({
      called: a.called + r.called,
      c3: a.c3 + r.c3,
      c7: a.c7 + r.c7,
      c14: a.c14 + r.c14,
      c31: a.c31 + r.c31,
      depTotal: a.depTotal + r.depTotal,
    }),
    { called: 0, c3: 0, c7: 0, c14: 0, c31: 0, depTotal: 0 }
  );

  const promoRows: CohortPromoRow[] = [
    { promo: true, ...promoAgg.true },
    { promo: false, ...promoAgg.false },
  ];

  const maxDep = await prisma.depositEvent.aggregate({ _max: { date: true } });
  const dataMaxYMD = maxDep._max.date ? maxDep._max.date.toISOString().slice(0, 10) : null;
  const matureFor = (n: number) => dataMaxYMD != null && addDaysYMD(toYMD, n) <= dataMaxYMD;
  const mature = { d3: matureFor(3), d7: matureFor(7), d14: matureFor(14), d31: matureFor(31) };

  return { fromYMD, toYMD, dataMaxYMD, mature, brandRows, brandTotal, promoRows };
}

// ====== Tier 3: ข้อมูลแนวโน้มรายวัน (สำหรับกราฟ) ======
// รวมทุกเว็บ/ผู้โทร ต่อวัน (วันไทย) — เติมวันที่ไม่มีข้อมูลเป็น 0 เพื่อให้กราฟต่อเนื่อง

export type DailyTrendRow = {
  ymd: string;
  calls: number;
  answered: number;
  depositTotal: number;
};

/** แนวโน้มรายวันรวมทุกเว็บ ในช่วง [fromYMD, toYMD] (วันไทย) — ทุกวันในช่วงมีแถวเสมอ */
export async function getDailyTrend(fromYMD: string, toYMD: string): Promise<DailyTrendRow[]> {
  const { callFrom, callToExcl, dateFrom, dateToExcl } = rangeBounds(fromYMD, toYMD);

  // CallLog: นับตามวันไทยของ calledAt
  const callRows = await prisma.$queryRaw<{ ymd: string; calls: bigint; answered: bigint }[]>`
    SELECT to_char((cl."calledAt" AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD') AS ymd,
      COUNT(*)::bigint AS calls,
      COUNT(*) FILTER (WHERE cl.outcome::text IN (${Prisma.join(ANSWERED_OUTCOMES)}))::bigint AS answered
    FROM "CallLog" cl
    WHERE cl."calledAt" >= ${callFrom} AND cl."calledAt" < ${callToExcl}
    GROUP BY 1`;

  // DepositEvent.date เป็น date-only (UTC midnight ของวันไทย) — ไม่ต้องแปลง timezone
  const depRows = await prisma.$queryRaw<{ ymd: string; deposit_total: number }[]>`
    SELECT to_char(d.date, 'YYYY-MM-DD') AS ymd,
      COALESCE(SUM(d.amount), 0) AS deposit_total
    FROM "DepositEvent" d
    WHERE d.amount > 0 AND d.date >= ${dateFrom} AND d.date < ${dateToExcl}
    GROUP BY 1`;

  const callMap = new Map(callRows.map((r) => [r.ymd, r]));
  const depMap = new Map(depRows.map((r) => [r.ymd, r]));

  const out: DailyTrendRow[] = [];
  for (let ymd = fromYMD; ymd <= toYMD; ymd = ymdAddDays(ymd, 1)) {
    const c = callMap.get(ymd);
    out.push({
      ymd,
      calls: Number(c?.calls ?? 0),
      answered: Number(c?.answered ?? 0),
      depositTotal: Number(depMap.get(ymd)?.deposit_total ?? 0),
    });
  }
  return out;
}

export type AgentDailyRow = {
  ymd: string;
  calls: number;
  answered: number;
  sms: number;
  promo: number;
};

/** ผลงานรายวัน (วันไทย) ของผู้โทรคนเดียว — callerId = null คือข้อมูลนำเข้า */
export async function getAgentDaily(
  callerId: number | null,
  fromYMD: string,
  toYMD: string
): Promise<AgentDailyRow[]> {
  const { callFrom, callToExcl } = rangeBounds(fromYMD, toYMD);
  const rows = await prisma.$queryRaw<
    { ymd: string; calls: bigint; answered: bigint; sms: bigint; promo: bigint }[]
  >`
    SELECT to_char((cl."calledAt" AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD') AS ymd,
      COUNT(*)::bigint AS calls,
      COUNT(*) FILTER (WHERE cl.outcome::text IN (${Prisma.join(ANSWERED_OUTCOMES)}))::bigint AS answered,
      COUNT(*) FILTER (WHERE cl."smsSent")::bigint AS sms,
      COUNT(*) FILTER (WHERE cl.disposition::text = 'PROMO_20')::bigint AS promo
    FROM "CallLog" cl
    WHERE cl."calledAt" >= ${callFrom} AND cl."calledAt" < ${callToExcl}
      AND cl."callerId" IS NOT DISTINCT FROM ${callerId}
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((r) => ({
    ymd: r.ymd,
    calls: Number(r.calls),
    answered: Number(r.answered),
    sms: Number(r.sms),
    promo: Number(r.promo),
  }));
}
