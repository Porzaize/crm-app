import { describe, it, expect } from "vitest";
import { renderTemplate, buildSmsContext, DEFAULT_PROMO } from "@/lib/sms";

describe("renderTemplate", () => {
  it("แทนค่าตัวแปรที่รู้จัก", () => {
    expect(renderTemplate("สวัสดีลูกค้า {{เว็บ}}", { เว็บ: "มรกต" })).toBe("สวัสดีลูกค้า มรกต");
  });
  it("รองรับช่องว่างรอบชื่อตัวแปร", () => {
    expect(renderTemplate("{{ เว็บ }}", { เว็บ: "มณี159" })).toBe("มณี159");
  });
  it("ตัวแปรไม่รู้จัก — คงโทเคนเดิมไว้ (ไม่แทนค่าว่างเงียบ ๆ)", () => {
    expect(renderTemplate("ทักทาย {{ชื่อ}}", {})).toBe("ทักทาย {{ชื่อ}}");
  });
  it("หลายตัวแปร + ตัวเดิมซ้ำ", () => {
    const out = renderTemplate("{{เว็บ}} โปร {{โปร}} ที่ {{เว็บ}}", { เว็บ: "เมก้า168", โปร: "20%" });
    expect(out).toBe("เมก้า168 โปร 20% ที่ เมก้า168");
  });
  it("ไม่มีตัวแปร — คืนข้อความเดิม", () => {
    expect(renderTemplate("ข้อความธรรมดา", { เว็บ: "x" })).toBe("ข้อความธรรมดา");
  });
});

describe("buildSmsContext", () => {
  it("คืน เว็บ/เบอร์(จัดรูป)/โปร", () => {
    const ctx = buildSmsContext({ brandName: "มรกต", phone: "0812345678", promo: "ฟรีเครดิต" });
    expect(ctx).toEqual({ เว็บ: "มรกต", เบอร์: "081-234-5678", โปร: "ฟรีเครดิต" });
  });
  it("โปรว่าง/เว้นวรรค → ใช้ค่า default", () => {
    expect(buildSmsContext({ brandName: "x", phone: "0800000000", promo: "  " }).โปร).toBe(DEFAULT_PROMO);
    expect(buildSmsContext({ brandName: "x", phone: "0800000000" }).โปร).toBe(DEFAULT_PROMO);
  });
});
