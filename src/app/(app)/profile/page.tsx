import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/labels";
import PasswordForm from "./PasswordForm";
import TwoFactorCard from "./TwoFactorCard";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { twoFactorEnabled: true },
  });

  return (
    <>
      <h1>โปรไฟล์ของฉัน</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <div className="card">
          <h2>ข้อมูลผู้ใช้</h2>
          <div className="field">
            <label>ชื่อแสดง</label>
            <div>{session.displayName}</div>
          </div>
          <div className="field">
            <label>ชื่อผู้ใช้</label>
            <div>{session.username}</div>
          </div>
          <div className="field">
            <label>บทบาท</label>
            <div>{ROLE_LABELS[session.role]}</div>
          </div>
        </div>

        <div className="card">
          <h2>เปลี่ยนรหัสผ่าน</h2>
          <PasswordForm />
        </div>
      </div>

      <div className="card">
        <h2>ยืนยันตัวตน 2 ชั้น (2FA)</h2>
        <TwoFactorCard enabled={user?.twoFactorEnabled ?? false} />
      </div>
    </>
  );
}
