// ตัวช่วยวันที่ timezone ไทย (Asia/Bangkok = UTC+7)
// เก็บใน DB เป็น UTC เสมอ แต่ "วัน" คิดตามเวลาไทย

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ต้นวัน (00:00 เวลาไทย) ของวันที่ที่ instant นี้ตกอยู่ คืนเป็น Date (UTC instant) */
export function bangkokDayStart(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + BKK_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  // 00:00 ไทย = (วันนั้น 00:00) - 7 ชม. ใน UTC
  return new Date(Date.UTC(y, m, day) - BKK_OFFSET_MS);
}

/** ต้นวันถัดไป (ใช้เป็นขอบบนแบบ exclusive) */
export function bangkokNextDayStart(d: Date = new Date()): Date {
  return new Date(bangkokDayStart(d).getTime() + 24 * 60 * 60 * 1000);
}

/** แปลงค่า <input type="datetime-local"> ("2026-06-11T18:00") เป็นเวลาไทย -> Date (UTC) */
export function parseBangkokLocal(value: string): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, da, h, mi] = m;
  return new Date(`${y}-${mo}-${da}T${h}:${mi}:00+07:00`);
}

/** สร้าง Date date-only (UTC midnight) จาก ปี/เดือน(1-12)/วัน */
export function dateOnlyUTC(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day));
}

/** วันไทยของ instant นี้ในรูป "YYYY-MM-DD" */
export function bangkokYMD(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + BKK_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`;
}

/** บวก/ลบวันให้สตริง "YYYY-MM-DD" (คิดแบบ UTC date-only เลี่ยงปัญหา DST/TZ) */
export function ymdAddDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** วันจันทร์ (วันไทย) ของสัปดาห์ที่ instant นี้ตกอยู่ ในรูป "YYYY-MM-DD" */
export function bangkokMondayYMD(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + BKK_OFFSET_MS);
  const dow = shifted.getUTCDay(); // 0=อา .. 1=จ .. 6=ส
  const back = dow === 0 ? 6 : dow - 1; // ถอยไปวันจันทร์
  return ymdAddDays(bangkokYMD(d), -back);
}

/** สร้าง instant จากวันไทย + เวลา (ชม./นาที) */
export function bangkokDateTime(
  year: number,
  month1to12: number,
  day: number,
  hour = 0,
  minute = 0
): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(
    `${year}-${pad(month1to12)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+07:00`
  );
}
