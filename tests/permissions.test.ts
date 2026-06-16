import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleHas,
  resolvePermissions,
  normalizePermissionInput,
  presetFor,
  listHas,
  type Permission,
} from "@/lib/permissions";

describe("permissions matrix", () => {
  it("ADMIN เป็น superuser — มีทุกสิทธิ์", () => {
    expect(ROLE_PERMISSIONS.ADMIN).toBe("*");
    for (const p of PERMISSIONS) {
      expect(roleHas("ADMIN", p)).toBe(true);
    }
  });

  it("AGENT มีแค่ดูลูกค้า + โทรในคิวตัวเอง", () => {
    expect(roleHas("AGENT", "customer.view")).toBe(true);
    expect(roleHas("AGENT", "queue.call")).toBe(true);
    // สิทธิ์ที่ห้ามมี
    expect(roleHas("AGENT", "queue.call_any")).toBe(false);
    expect(roleHas("AGENT", "customer.export")).toBe(false);
    expect(roleHas("AGENT", "report.view")).toBe(false);
    expect(roleHas("AGENT", "user.manage")).toBe(false);
    expect(roleHas("AGENT", "customer.status")).toBe(false);
  });

  it("SUPERVISOR มีสิทธิ์ปฏิบัติงาน แต่ไม่ใช่สิทธิ์แอดมิน", () => {
    expect(roleHas("SUPERVISOR", "report.view")).toBe(true);
    expect(roleHas("SUPERVISOR", "customer.export")).toBe(true);
    expect(roleHas("SUPERVISOR", "queue.assign")).toBe(true);
    expect(roleHas("SUPERVISOR", "import.run")).toBe(true);
    expect(roleHas("SUPERVISOR", "sms.manage")).toBe(true);
    // สิทธิ์แอดมินล้วน ห้ามมี
    expect(roleHas("SUPERVISOR", "user.manage")).toBe(false);
    expect(roleHas("SUPERVISOR", "brand.manage")).toBe(false);
    expect(roleHas("SUPERVISOR", "audit.view")).toBe(false);
    expect(roleHas("SUPERVISOR", "activity.view")).toBe(false);
    // ตั้งค่าแจ้งเตือน Telegram = สงวนให้ผู้ดูแลระบบ (ตัดออกจากค่าตั้งต้นหัวหน้าทีม)
    expect(roleHas("SUPERVISOR", "notification.manage")).toBe(false);
  });

  it("ทุก permission ใน matrix ต้องเป็น key ที่มีจริงใน PERMISSIONS (กัน typo)", () => {
    const valid = new Set<string>(PERMISSIONS);
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      if (perms === "*") continue;
      for (const p of perms as readonly Permission[]) {
        expect(valid.has(p), `${role} อ้างถึง permission ที่ไม่มี: ${p}`).toBe(true);
      }
    }
  });

  it("ไม่มี permission ซ้ำในบทบาทเดียวกัน", () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      if (perms === "*") continue;
      const arr = perms as readonly Permission[];
      expect(new Set(arr).size).toBe(arr.length);
    }
  });
});

describe("สิทธิ์รายคน (override บทบาท)", () => {
  it("ADMIN ได้ทุกสิทธิ์เสมอ แม้ตั้ง custom", () => {
    expect(resolvePermissions("ADMIN", true, [])).toBe("*");
    expect(resolvePermissions("ADMIN", false, ["customer.view"])).toBe("*");
  });

  it("ไม่ custom → ใช้ค่าตั้งต้นของบทบาท", () => {
    expect(resolvePermissions("AGENT", false, [])).toBe(ROLE_PERMISSIONS.AGENT);
    expect(resolvePermissions("SUPERVISOR", false, ["customer.view"])).toBe(ROLE_PERMISSIONS.SUPERVISOR);
  });

  it("custom → ใช้รายการที่ติ๊ก (กรองเฉพาะ key ที่ถูกต้อง)", () => {
    const r = resolvePermissions("AGENT", true, ["customer.view", "report.view", "ของปลอม"]);
    expect(listHas(r, "customer.view")).toBe(true);
    expect(listHas(r, "report.view")).toBe(true);
    expect(listHas(r, "queue.call")).toBe(false);
    expect(r).not.toContain("ของปลอม");
  });

  it("normalize: ติ๊กตรง preset = สืบทอดบทบาท (ไม่ custom)", () => {
    const sel = presetFor("SUPERVISOR").map(String);
    expect(normalizePermissionInput("SUPERVISOR", sel)).toEqual({ customPermissions: false, permissions: [] });
  });

  it("normalize: ติ๊กต่างจาก preset = custom", () => {
    const sel = ["customer.view", "report.view"];
    const out = normalizePermissionInput("AGENT", sel);
    expect(out.customPermissions).toBe(true);
    expect(out.permissions).toEqual(["customer.view", "report.view"]);
  });

  it("normalize: ADMIN ไม่เก็บ override", () => {
    expect(normalizePermissionInput("ADMIN", ["customer.view"])).toEqual({ customPermissions: false, permissions: [] });
  });

  it("normalize: ตัด key ปลอมทิ้ง", () => {
    const out = normalizePermissionInput("AGENT", ["customer.view", "ปลอม", "queue.call"]);
    // customer.view + queue.call = preset ของ AGENT พอดี → สืบทอด
    expect(out).toEqual({ customPermissions: false, permissions: [] });
  });
});
