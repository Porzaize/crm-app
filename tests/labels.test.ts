import { describe, it, expect } from "vitest";
import {
  formatPhone,
  maskPhone,
  formatMoney,
  ANSWERED_OUTCOMES,
  auditActionLabel,
} from "@/lib/labels";

describe("formatPhone", () => {
  it("เบอร์ 10 หลัก → จัดรูป xxx-xxx-xxxx", () => {
    expect(formatPhone("0812345678")).toBe("081-234-5678");
  });
  it("เบอร์ 9 หลัก (ตัด 0 หน้า) → เติม 0 แล้วจัดรูป", () => {
    expect(formatPhone("812345678")).toBe("081-234-5678");
  });
  it("ตัดอักขระไม่ใช่ตัวเลขออกก่อน", () => {
    expect(formatPhone("081-234-5678")).toBe("081-234-5678");
  });
  it("ความยาวผิดปกติ → คืนเลขล้วน (ไม่จัดรูปมั่ว)", () => {
    expect(formatPhone("66812345678")).toBe("66812345678");
  });
});

describe("maskPhone", () => {
  it("ปิด 3 หลักกลาง", () => {
    expect(maskPhone("0812345678")).toBe("081-xxx-5678");
  });
});

describe("formatMoney", () => {
  it("null/undefined → 0", () => {
    expect(formatMoney(null)).toBe("0");
    expect(formatMoney(undefined)).toBe("0");
  });
  it("คั่นหลักพัน + ทศนิยมไม่เกิน 2", () => {
    expect(formatMoney(1234.5)).toBe("1,234.5");
    expect(formatMoney(1000000)).toBe("1,000,000");
    expect(formatMoney(0)).toBe("0");
  });
});

describe("ANSWERED_OUTCOMES", () => {
  it("นิยาม 'รับสาย' = 3 ค่า (ตรงทั้งแดชบอร์ด/รายงาน)", () => {
    expect(ANSWERED_OUTCOMES).toEqual(["ANSWERED", "ANSWERED_HUNG_UP", "ANSWERED_SILENT"]);
  });
});

describe("auditActionLabel", () => {
  it("action ที่รู้จัก → ป้ายไทย", () => {
    expect(auditActionLabel("user.login")).toBe("เข้าสู่ระบบ");
  });
  it("action ที่ไม่รู้จัก → คืนค่าเดิม", () => {
    expect(auditActionLabel("something.unknown")).toBe("something.unknown");
  });
});
