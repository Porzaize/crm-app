import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/labels";
import RegisterAdmin from "./RegisterAdmin";
import RowPermissions from "./RowPermissions";
import ConfirmButton from "@/components/ConfirmButton";
import { resetPassword, setActive, updateUser, unlockUser } from "./actions";
import { resolvePermissions } from "@/lib/permissions";
import type { Prisma, Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const ROLE_KEYS: Role[] = ["ADMIN", "SUPERVISOR", "AGENT"];
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "AGENT", label: "พนักงาน" },
  { value: "SUPERVISOR", label: "หัวหน้าทีม" },
  { value: "ADMIN", label: "ผู้ดูแลระบบ" },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[]; q?: string }>;
}) {
  await requirePermission("user.manage");
  const sp = await searchParams;

  const roleParam = sp.role;
  const rolesRaw = Array.isArray(roleParam) ? roleParam : roleParam ? [roleParam] : [];
  const selectedRoles = rolesRaw.filter((r) => (ROLE_KEYS as string[]).includes(r)) as Role[];
  const q = (sp.q ?? "").trim();

  const where: Prisma.UserWhereInput = {
    ...(selectedRoles.length ? { role: { in: selectedRoles } } : {}),
    ...(q ? { username: { contains: q, mode: "insensitive" } } : {}),
  };

  const [users, loginAgg] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { id: "asc" } }),
    prisma.auditLog.groupBy({ by: ["userId"], where: { action: "user.login" }, _max: { createdAt: true } }),
  ]);

  const lastLogin = new Map<number, Date>();
  for (const g of loginAgg) if (g.userId != null && g._max.createdAt) lastLogin.set(g.userId, g._max.createdAt);
  const now = new Date();

  return (
    <>
      <h1>จัดการผู้ใช้งาน</h1>

      <RegisterAdmin />

      {/* ฟิลเตอร์ */}
      <div className="card">
        <form method="get">
          <label style={{ marginBottom: "0.5rem" }}>บทบาท</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
            {ROLE_OPTIONS.map((r) => (
              <label key={r.value} style={{ fontWeight: 400, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                <input
                  type="checkbox"
                  name="role"
                  value={r.value}
                  defaultChecked={selectedRoles.includes(r.value as Role)}
                  style={{ width: "auto" }}
                />
                {r.label}
              </label>
            ))}
            <span className="muted" style={{ alignSelf: "center" }}>(ไม่เลือก = ทั้งหมด)</span>
          </div>
          <div className="row">
            <div>
              <label htmlFor="q">ชื่อผู้ใช้</label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="ค้นหาชื่อผู้ใช้" />
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <button type="submit">ค้นหา</button>
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>ผู้ใช้ทั้งหมด ({users.length})</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>ชื่อผู้ใช้</th>
                <th>แก้ไขชื่อ / บทบาท</th>
                <th>สิทธิ์การเข้าถึง</th>
                <th>สถานะ</th>
                <th>ถูกล็อค</th>
                <th>เข้าสู่ระบบล่าสุด</th>
                <th>สร้างเมื่อ</th>
                <th>รีเซ็ตรหัสผ่าน</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: "center" }}>
                    ไม่พบผู้ใช้
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td>
                    <form action={updateUser} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input name="displayName" type="text" defaultValue={u.displayName} style={{ width: 120 }} />
                      <select name="role" defaultValue={u.role}>
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn-secondary">
                        บันทึก
                      </button>
                    </form>
                  </td>
                  <td>
                    {(() => {
                      const r = resolvePermissions(u.role, u.customPermissions, u.permissions);
                      return (
                        <RowPermissions
                          userId={u.id}
                          role={u.role}
                          effective={r === "*" ? [] : [...r]}
                          custom={u.customPermissions}
                        />
                      );
                    })()}
                  </td>
                  <td>
                    <span className={`badge ${u.active ? "green" : "red"}`}>
                      {u.active ? "ใช้งาน" : "ห้ามใช้งาน"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {u.lockedUntil && u.lockedUntil > now ? (
                      <form action={unlockUser} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="hidden" name="userId" value={u.id} />
                        <span className="badge red">ถูกล็อก</span>
                        <button type="submit" className="btn-secondary">
                          ปลดล็อก
                        </button>
                      </form>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {lastLogin.has(u.id) ? formatDateTime(lastLogin.get(u.id)) : <span className="muted">—</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(u.createdAt)}</td>
                  <td>
                    <form action={resetPassword} style={{ display: "flex", gap: 6 }}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input name="password" type="text" placeholder="รหัสใหม่" style={{ width: 120 }} autoComplete="off" />
                      <button type="submit" className="btn-secondary">
                        รีเซ็ต
                      </button>
                    </form>
                  </td>
                  <td>
                    <form action={setActive}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                      {u.active ? (
                        <ConfirmButton
                          className="btn-secondary"
                          message={`ห้ามใช้งานบัญชี "${u.username}"? ผู้ใช้จะถูกบังคับออกจากระบบและเข้าใช้งานไม่ได้`}
                        >
                          ห้ามใช้งาน
                        </ConfirmButton>
                      ) : (
                        <button type="submit" className="btn-secondary">
                          เปิดใช้งาน
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
