import type { CSSProperties } from "react";
import { formatPhone } from "@/lib/labels";

/**
 * เบอร์โทรแบบกดโทรได้ (tel:) — แสดงเบอร์รูปแบบ xxx-xxx-xxxx แต่ลิงก์ใช้ตัวเลขล้วน
 * บนมือถือ/ซอฟต์โฟนจะเปิดแอปโทรออกให้ทันที
 */
export default function PhoneLink({
  phone,
  className,
  style,
}: {
  phone: string;
  className?: string;
  style?: CSSProperties;
}) {
  const digits = phone.replace(/\D/g, "");
  return (
    <a href={`tel:${digits}`} className={className} style={style} title="กดเพื่อโทรออก">
      {formatPhone(phone)}
    </a>
  );
}
