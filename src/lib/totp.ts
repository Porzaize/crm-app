import "server-only";
import crypto from "node:crypto";

// TOTP (RFC 6238) + base32 — เขียนเองด้วย node:crypto ไม่พึ่ง dependency
// ใช้กับ Google Authenticator / Authy ฯลฯ (SHA1, 6 หลัก, ช่วง 30 วินาที)

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ISSUER = "CRM ติดตามลูกค้า";

/** สุ่ม secret base32 (ค่าเริ่มต้น 20 ไบต์ = 160 บิต) */
export function generateSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let bits = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = "";
  for (const c of clean) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

/** รหัส 6 หลัก ณ เวลาปัจจุบัน (ใช้ตอนทดสอบ) */
export function totp(secretB32: string, at = Date.now()): string {
  return hotp(base32Decode(secretB32), Math.floor(at / 1000 / 30));
}

/** ตรวจรหัส — ยอมรับ ±window ช่วง (กันเวลาคลาดเคลื่อน) */
export function verifyTotp(secretB32: string, token: string, window = 1): boolean {
  const t = (token || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  const secret = base32Decode(secretB32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (hotp(secret, counter + w) === t) return true;
  }
  return false;
}

/** otpauth:// URI สำหรับสร้าง QR ให้สแกนในแอป */
export function otpauthURL(secretB32: string, account: string): string {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  const params = new URLSearchParams({
    secret: secretB32,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
