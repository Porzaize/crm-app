import { requireSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession();

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
    </>
  );
}
