// คลังข้อความ SMS (ข้อ 11) — ระบบ template ตัวแปร
// renderTemplate เป็นฟังก์ชัน pure (string + object -> string) แยกไว้ทดสอบง่าย ไม่พึ่ง DB/RSC
import { formatPhone } from "./labels";

/** ข้อความโปรเริ่มต้น ใช้เมื่อ context ไม่ได้ส่ง {{โปร}} มา (เก็บค่ากลางไว้ที่เดียว) */
export const DEFAULT_PROMO = "โบนัส 20%";

/** ตัวแปรที่รองรับ — ใช้โชว์เป็นคำใบ้ในหน้าจัดการ template ด้วย */
export const TEMPLATE_VARS: { token: string; desc: string }[] = [
  { token: "{{เว็บ}}", desc: "ชื่อแบรนด์ของลูกค้า" },
  { token: "{{เบอร์}}", desc: "เบอร์โทรลูกค้า" },
  { token: "{{โปร}}", desc: "ข้อความโปรปัจจุบัน" },
];

export type SmsContext = Record<string, string>;

/**
 * แทนค่าตัวแปร {{ชื่อ}} ในเนื้อความด้วยค่าจาก context
 * - รองรับช่องว่างรอบชื่อ: {{ เว็บ }} = {{เว็บ}}
 * - ตัวแปรที่ไม่รู้จัก (ไม่มีใน context): คงโทเคนเดิมไว้ {{x}} โดยตั้งใจ
 *   เพื่อให้คนเห็นทันทีว่ายังมีตัวแปรไม่ถูกแทน ดีกว่าแทนเป็นค่าว่างเงียบ ๆ แล้วส่ง SMS พร่อง
 */
export function renderTemplate(body: string, context: SmsContext): string {
  return body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (whole, rawName: string) => {
    const name = rawName.trim();
    return Object.prototype.hasOwnProperty.call(context, name) ? context[name] : whole;
  });
}

/** สร้าง context ของลูกค้ารายหนึ่งสำหรับแทนค่าใน template */
export function buildSmsContext(input: {
  brandName: string;
  phone: string;
  promo?: string;
}): SmsContext {
  return {
    เว็บ: input.brandName,
    เบอร์: formatPhone(input.phone),
    โปร: input.promo?.trim() || DEFAULT_PROMO,
  };
}
