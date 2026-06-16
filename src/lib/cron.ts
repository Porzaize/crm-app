import "server-only";
import { prisma } from "@/lib/db";
import { getBrandSummary } from "@/lib/report";
import { escapeHtml } from "@/lib/telegram";
import { formatMoney } from "@/lib/labels";
import {
  bangkokYMD,
  ymdAddDays,
  bangkokMondayYMD,
  bangkokDayStart,
  bangkokNextDayStart,
} from "@/lib/dates";

const intFmt = (n: number) => n.toLocaleString("th-TH");
const pct = (num: number, den: number) => (den > 0 ? ((num / den) * 100).toFixed(1) + "%" : "-");

/** ป้ายวันไทยอ่านง่าย เช่น "12 มิ.ย. 2026" จาก YMD */
function thaiDate(ymd: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ymd + "T00:00:00+07:00"));
}

function deltaLabel(now: number, prev: number): string {
  if (prev === 0) return now > 0 ? " (▲ ใหม่)" : "";
  const diff = ((now - prev) / prev) * 100;
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "▬";
  return ` (${arrow} ${Math.abs(diff).toFixed(0)}%)`;
}

// ===== สรุปรายวัน (20:00) -> กลุ่มทีม =====
export async function buildDailySummary(): Promise<string> {
  const today = bangkokYMD();
  const res = await getBrandSummary(today, today);
  const smsTotal = await prisma.callLog.count({
    where: { smsSent: true, calledAt: { gte: bangkokDayStart(), lt: bangkokNextDayStart() } },
  });

  const lines = res.rows
    .filter((r) => r.calls > 0 || r.depositTotal > 0)
    .map(
      (r) =>
        `• <b>${escapeHtml(r.name)}</b>: โทร ${intFmt(r.calls)} · รับ ${pct(r.answered, r.calls)} · ฝาก ${intFmt(
          r.depositors
        )} ราย/${formatMoney(r.depositTotal)}฿`
    );

  const t = res.total;
  return (
    `📊 <b>สรุปวันนี้</b> ${escapeHtml(thaiDate(today))}\n` +
    (lines.length ? lines.join("\n") + "\n" : "ยังไม่มีการโทรวันนี้\n") +
    `\n<b>รวม</b>: โทร ${intFmt(t.calls)} · รับสาย ${intFmt(t.answered)} (${pct(t.answered, t.calls)})\n` +
    `SMS ${intFmt(smsTotal)} · กลับมาฝาก ${intFmt(t.depositors)} ราย / ${formatMoney(t.depositTotal)}฿\n` +
    `โบนัส ${formatMoney(t.bonusTotal)}฿`
  );
}

// ===== สรุปรายสัปดาห์ (จันทร์ 08:00) -> กลุ่มหัวหน้า =====
export async function buildWeeklySummary(): Promise<string> {
  const thisMon = bangkokMondayYMD();
  const lwStart = ymdAddDays(thisMon, -7);
  const lwEnd = ymdAddDays(thisMon, -1);
  const pwStart = ymdAddDays(thisMon, -14);
  const pwEnd = ymdAddDays(thisMon, -8);

  const cur = (await getBrandSummary(lwStart, lwEnd)).total;
  const prev = (await getBrandSummary(pwStart, pwEnd)).total;

  const row = (label: string, n: number, p: number, money = false) =>
    `${label}: ${money ? formatMoney(n) + "฿" : intFmt(n)}${deltaLabel(n, p)}`;

  return (
    `📈 <b>สรุปสัปดาห์ก่อน</b>\n${escapeHtml(thaiDate(lwStart))} – ${escapeHtml(thaiDate(lwEnd))}\n` +
    `(เทียบ ${escapeHtml(thaiDate(pwStart))} – ${escapeHtml(thaiDate(pwEnd))})\n\n` +
    `${row("โทรติดตาม", cur.calls, prev.calls)}\n` +
    `${row("รับสาย", cur.answered, prev.answered)} (${pct(cur.answered, cur.calls)})\n` +
    `${row("ลูกค้ากลับมาฝาก", cur.depositors, prev.depositors)}\n` +
    `${row("ยอดฝาก", cur.depositTotal, prev.depositTotal, true)}\n` +
    `${row("โบนัส", cur.bonusTotal, prev.bonusTotal, true)}`
  );
}

// ===== คิวเช้า (09:00) -> กลุ่มทีม =====
export async function buildMorningQueue(): Promise<string> {
  const now = new Date();
  const dueBefore = bangkokNextDayStart(now); // นัดถึงกำหนด "วันนี้" = ก่อนต้นวันพรุ่งนี้

  const [pendingByUser, dueByUser, users] = await Promise.all([
    prisma.campaignContact.groupBy({
      by: ["assignedToId"],
      where: { status: "PENDING" },
      _count: { _all: true },
    }),
    prisma.campaignContact.groupBy({
      by: ["assignedToId"],
      where: { status: "PENDING", nextCallAt: { not: null, lt: dueBefore } },
      _count: { _all: true },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, displayName: true } }),
  ]);

  const nameById = new Map(users.map((u) => [u.id, u.displayName]));
  const dueById = new Map(dueByUser.map((d) => [d.assignedToId, d._count._all]));

  const lines = pendingByUser
    .filter((p) => p.assignedToId != null && p._count._all > 0)
    .map((p) => ({
      name: nameById.get(p.assignedToId!) ?? `#${p.assignedToId}`,
      pending: p._count._all,
      due: dueById.get(p.assignedToId) ?? 0,
    }))
    .sort((a, b) => b.pending - a.pending)
    .map((r) => `• <b>${escapeHtml(r.name)}</b>: คิวรอโทร ${intFmt(r.pending)}${r.due ? ` · นัดถึงกำหนด ${intFmt(r.due)}` : ""}`);

  return (
    `🌅 <b>คิวเช้านี้</b> ${escapeHtml(thaiDate(bangkokYMD(now)))}\n` +
    (lines.length ? lines.join("\n") : "ไม่มีคิวค้างของพนักงาน")
  );
}

// ===== เตือนโทรช้า (13:00) -> กลุ่มหัวหน้า =====
export async function buildSlowDayAlert(threshold: number): Promise<string | null> {
  const callsToday = await prisma.callLog.groupBy({
    by: ["callerId"],
    where: { calledAt: { gte: bangkokDayStart(), lt: bangkokNextDayStart() } },
    _count: { _all: true },
  });
  const countById = new Map(callsToday.map((c) => [c.callerId, c._count._all]));

  const agents = await prisma.user.findMany({
    where: { active: true, role: "AGENT" },
    select: { id: true, displayName: true },
  });

  const slow = agents
    .map((a) => ({ name: a.displayName, calls: countById.get(a.id) ?? 0 }))
    .filter((a) => a.calls < threshold)
    .sort((a, b) => a.calls - b.calls);

  if (slow.length === 0) return null; // ทุกคนถึงเกณฑ์ -> ไม่ต้องส่ง

  const lines = slow.map((a) => `• <b>${escapeHtml(a.name)}</b>: ${intFmt(a.calls)}/${intFmt(threshold)} สาย`);
  return (
    `🐌 <b>เตือนโทรช้า</b> (เกณฑ์ ${intFmt(threshold)} สายก่อนเที่ยง)\n` +
    `ณ ${escapeHtml(thaiDate(bangkokYMD()))}\n` +
    lines.join("\n")
  );
}
