import { requireSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession();

  return (
    <>
      <h1>โปรไฟล์ของฉัน</h1>

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
    </>
  );
}
