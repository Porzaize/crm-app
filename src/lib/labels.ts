import type {
  Role,
  CustomerStatus,
  ContactStatus,
  CallOutcome,
  CallDisposition,
} from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  SUPERVISOR: "หัวหน้าทีม",
  AGENT: "พนักงาน",
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: "ใช้งานอยู่",
  LAPSED: "ขาดฝาก",
  DO_NOT_CALL: "ห้ามโทร",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  PENDING: "รอโทร",
  DONE: "โทรแล้ว",
};

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  ANSWERED: "รับสาย",
  ANSWERED_HUNG_UP: "รับแล้วตัดสาย",
  ANSWERED_SILENT: "รับแล้วเงียบ",
  NO_ANSWER: "ไม่รับสาย",
  UNREACHABLE: "ติดต่อไม่ได้",
  CALL_DROPPED: "ตัดสาย",
  VOICEMAIL: "ฝากข้อความ",
  NOT_INTERESTED: "ไม่สนใจ",
  INCONVENIENT: "ไม่สะดวก",
  QUIT_PLAYING: "เลิกเล่น",
  NOT_REGISTERED: "ไม่ได้สมัคร",
  DUPLICATE: "เบอร์ซ้ำ",
  OTHER: "อื่น ๆ",
};

/** ผลสายที่ถือว่า "รับสาย/คุยได้" */
export const ANSWERED_OUTCOMES: CallOutcome[] = [
  "ANSWERED",
  "ANSWERED_HUNG_UP",
  "ANSWERED_SILENT",
];

export const DISPOSITION_LABELS: Record<CallDisposition, string> = {
  NONE: "-",
  PROMO_20: "เสนอโปร 20%",
};

// Audit Log (ข้อ 10) — ป้ายภาษาไทยของ action
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "customer.status_change": "เปลี่ยนสถานะลูกค้า",
  "customer.create": "เพิ่มลูกค้า",
  "customer.update": "แก้ไขข้อมูลลูกค้า",
  "customer.assign": "มอบหมายงานโทร",
  "customer.add_deposit": "บันทึกยอดฝาก",
  "customer.add_bonus": "บันทึกโบนัส",
  "customer.archive": "เก็บลูกค้า (ซ่อน)",
  "customer.restore": "กู้คืนลูกค้า",
  "customer.bulk_assign": "มอบหมายงานเป็นชุด",
  "campaign.create": "สร้างแคมเปญ",
  "campaign.rename": "เปลี่ยนชื่อแคมเปญ",
  "campaign.set_active": "เปิด/ปิดแคมเปญ",
  "user.login": "เข้าสู่ระบบ",
  "user.login_failed": "เข้าสู่ระบบล้มเหลว",
  "user.create": "สร้างผู้ใช้",
  "user.update": "แก้ไขผู้ใช้",
  "user.reset_password": "รีเซ็ตรหัสผ่าน",
  "user.set_active": "เปิด/ปิดผู้ใช้",
  "user.unlock": "ปลดล็อกบัญชี",
  "user.permissions_change": "ปรับสิทธิ์ผู้ใช้",
  "brand.create": "เพิ่มเว็บ",
  "brand.rename": "เปลี่ยนชื่อเว็บ",
  "import.excel": "นำเข้าข้อมูล Excel",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function formatPhone(phone: string): string {
  const p = phone.replace(/\D/g, "").padStart(10, "0");
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  return p;
}

export function maskPhone(phone: string): string {
  const p = phone.replace(/\D/g, "").padStart(10, "0");
  return `${p.slice(0, 3)}-xxx-${p.slice(6)}`;
}

const moneyFmt = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "0";
  return moneyFmt.format(n);
}

const dateFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return dateFmt.format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return dateTimeFmt.format(new Date(d));
}
