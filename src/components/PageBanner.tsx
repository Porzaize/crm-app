import type { ReactNode } from "react";

/**
 * หัวข้อหน้าแบบแบนเนอร์ไล่สี (อินดิโก้) — ใช้แทน <h1> ในหน้าหลัก
 * children = ปุ่ม/ลิงก์ฝั่งขวาของแบนเนอร์ (optional)
 */
export default function PageBanner({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="page-banner">
      <div>
        <h1 className="page-banner-title" style={{ margin: 0, color: "#fff" }}>
          {title}
        </h1>
        {subtitle && <div className="page-banner-sub">{subtitle}</div>}
      </div>
      {children && <div className="page-banner-actions">{children}</div>}
    </div>
  );
}
