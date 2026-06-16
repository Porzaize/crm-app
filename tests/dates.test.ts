import { describe, it, expect } from "vitest";
import {
  bangkokYMD,
  ymdAddDays,
  dateOnlyUTC,
  bangkokDayStart,
  bangkokNextDayStart,
  bangkokMondayYMD,
  bangkokDateTime,
} from "@/lib/dates";

// วันไทย (Asia/Bangkok = UTC+7) — logic นี้คุมขอบช่วงของรายงาน/การให้เครดิตยอดฝากทั้งหมด
describe("bangkokYMD", () => {
  it("เวลา UTC ก่อน 17:00 = วันไทยเดียวกัน", () => {
    expect(bangkokYMD(new Date("2026-06-14T16:59:00Z"))).toBe("2026-06-14");
  });
  it("17:00 UTC = เที่ยงคืนวันไทยถัดไป (ขอบสำคัญ)", () => {
    expect(bangkokYMD(new Date("2026-06-14T17:00:00Z"))).toBe("2026-06-15");
  });
});

describe("ymdAddDays", () => {
  it("บวกวันข้ามเดือน", () => {
    expect(ymdAddDays("2026-06-14", 1)).toBe("2026-06-15");
    expect(ymdAddDays("2026-06-30", 1)).toBe("2026-07-01");
  });
  it("ลบวันข้ามเดือน/ปี", () => {
    expect(ymdAddDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(ymdAddDays("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("บวก 0 = วันเดิม", () => {
    expect(ymdAddDays("2026-06-14", 0)).toBe("2026-06-14");
  });
});

describe("dateOnlyUTC", () => {
  it("คืน UTC midnight ของวันไทย", () => {
    expect(dateOnlyUTC(2026, 6, 14).toISOString()).toBe("2026-06-14T00:00:00.000Z");
  });
});

describe("bangkokDayStart / NextDayStart", () => {
  it("ต้นวันไทย = 17:00 UTC ของวันก่อนหน้า", () => {
    // instant Thai 2026-06-15 08:00 = 2026-06-15T01:00Z → ต้นวัน = Thai 06-15 00:00 = 06-14T17:00Z
    const start = bangkokDayStart(new Date("2026-06-15T01:00:00Z"));
    expect(start.toISOString()).toBe("2026-06-14T17:00:00.000Z");
  });
  it("NextDayStart = DayStart + 24 ชม.", () => {
    const d = new Date("2026-06-15T01:00:00Z");
    expect(bangkokNextDayStart(d).getTime() - bangkokDayStart(d).getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("bangkokDateTime", () => {
  it("สร้าง instant จากวันไทย+เวลา", () => {
    // 2026-06-14 00:00 ไทย = 2026-06-13T17:00Z
    expect(bangkokDateTime(2026, 6, 14, 0, 0).toISOString()).toBe("2026-06-13T17:00:00.000Z");
  });
});

describe("bangkokMondayYMD", () => {
  it("คืนวันจันทร์ (ไทย) ที่ <= วันนั้น และห่างไม่เกิน 6 วัน", () => {
    for (const iso of ["2026-06-10T05:00:00Z", "2026-06-14T20:00:00Z", "2026-01-01T00:00:00Z"]) {
      const d = new Date(iso);
      const mon = bangkokMondayYMD(d);
      // ผลลัพธ์ต้องเป็นวันจันทร์จริงตามเวลาไทย
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        weekday: "short",
      }).format(new Date(mon + "T12:00:00+07:00"));
      expect(weekday, `${iso} → ${mon}`).toBe("Mon");
      // ต้องไม่อยู่หลังวันนั้น และห่างไม่เกิน 6 วัน
      const today = bangkokYMD(d);
      expect(mon <= today).toBe(true);
      expect(ymdAddDays(mon, 6) >= today).toBe(true);
    }
  });
});
