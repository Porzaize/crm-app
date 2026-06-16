// ปุ่มลัดช่วงวันที่ (เวลาไทย) ใช้ร่วมหน้ารายงานต่าง ๆ (ข้อ 4, 8, ...)
const DAY_MS = 24 * 60 * 60 * 1000;

export type Preset = { key: string; label: string; from: string; to: string };

/** วันนี้ตามเวลาไทย เป็น UTC-midnight Date ที่แทน "วันปฏิทินไทย" */
function bangkokTodayUTC(): Date {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function buildPresets(): Preset[] {
  const today = bangkokTodayUTC();
  const dow = today.getUTCDay(); // 0=อา..6=ส
  const offsetToMonday = (dow + 6) % 7;
  const thisMonday = addDays(today, -offsetToMonday);
  const lastMonday = addDays(thisMonday, -7);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1));
  const monthEnd = new Date(Date.UTC(y, m + 1, 0));
  const lastMonthStart = new Date(Date.UTC(y, m - 1, 1));
  const lastMonthEnd = new Date(Date.UTC(y, m, 0));

  return [
    { key: "this-week", label: "สัปดาห์นี้", from: ymd(thisMonday), to: ymd(addDays(thisMonday, 6)) },
    { key: "last-week", label: "สัปดาห์ก่อน", from: ymd(lastMonday), to: ymd(addDays(lastMonday, 6)) },
    { key: "this-month", label: "เดือนนี้", from: ymd(monthStart), to: ymd(monthEnd) },
    { key: "last-month", label: "เดือนก่อน", from: ymd(lastMonthStart), to: ymd(lastMonthEnd) },
  ];
}
