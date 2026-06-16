# แผนพัฒนาต่อ — CRM โทรติดตามลูกค้า

อัปเดตล่าสุด: 15 มิ.ย. 2026 · เว็บจริง: https://crm-app-one-steel.vercel.app

> เอกสารนี้รวม "สิ่งที่ยังขาด" เพื่อให้ระบบสมบูรณ์ขึ้น เรียงตามความสำคัญ
> สถานะ: ✅ เสร็จแล้ว · 🟡 กำลังทำ · ⬜ ยังไม่ทำ

---

## ✅ ทำเสร็จแล้ว (สรุป)
- การบ้าน 12 ข้อครบ (เปลี่ยนรหัส, export CSV/Excel, ตัวกรองคิว, รายงานสัปดาห์/เดือน, นัดโทรกลับ, Do-Not-Call, ผลงานพนักงาน, Cohort, Audit Log, คลังข้อความ SMS, แจ้งเตือน Telegram)
- จัดการลูกค้า: เพิ่ม/แก้ไข/มอบหมาย/บันทึกฝาก-โบนัส/เก็บ (soft-delete)
- จัดการผู้ใช้/แอดมิน (หน้าใหม่: แบนเนอร์+ฟอร์มลงทะเบียน+ฟิลเตอร์บทบาท+เข้าระบบล่าสุด), จัดการเว็บ, จัดการแคมเปญ
- มอบหมายงานเป็นชุด (queue), นำเข้าไฟล์ผ่านเว็บ + **กันซ้ำ/preview**
- ตรวจสอบทุจริต + login audit, **ล็อกบัญชีอัตโนมัติ + revoke session**
- ยกเครื่อง UI/UX (sidebar กลุ่ม+ไอคอน, การ์ด/ตารางใหม่)

---

## 🥇 Tier 1 — ความปลอดภัย/ความถูกต้อง (ทำให้จบก่อน)
- ⬜ **2FA / Google Authenticator (TOTP)** — สแกน QR ด้วยแอป, บังคับ/เลือกได้รายบัญชี → เติมคอลัมน์ "กูเกิล ออเธน" ในรูปอ้างอิง · *ขนาด: กลาง*
- ✅ **กล่องยืนยันก่อนทำลายข้อมูล** (confirm) — เก็บลูกค้า, มอบหมายชุด, ปิดบัญชี, เปลี่ยนชื่อเว็บ (component กลาง `src/components/ConfirmButton.tsx`) · *ขนาด: เล็ก*
- ✅ **ประวัติการนำเข้า (Import History)** — หน้า `/admin/import/history` (query auditLog `action="import.excel"`) แสดง เวลา/ผู้ทำ/ช่องทาง(เว็บ·CLI)/ไฟล์/จำนวนที่นำเข้า · ลิงก์จากหน้า "นำเข้าข้อมูล" · *ขนาด: เล็ก-กลาง*

## 🥈 Tier 2 — งาน Call Center (เพิ่มประสิทธิภาพจริง)
- ✅ **เป้าโทรรายวันต่อคน + แถบความคืบหน้า** — แดชบอร์ด: พนักงานเห็นของตัวเอง / หัวหน้าเห็นรายคน · เป้า `DAILY_CALL_TARGET=30` ใน `constants.ts` (ยัง hardcode — ตั้งค่าได้ทีหลัง) · component `src/components/ProgressBar.tsx` · *กลาง*
- ⬜ **เตือนนัดโทรถึงตัวพนักงานเอง** — badge/แจ้งเตือนเมื่อถึงเวลานัด (ตอนนี้มีแค่ cron กลุ่ม) · *กลาง*
- ⬜ **บันทึกระยะเวลาคุย (call duration)** — เก็บเวลาคุยต่อสาย ไว้วัดคุณภาพ · *เล็ก-กลาง*
- ✅ **คลิกโทร (tel: link)** ที่เบอร์ — component `src/components/PhoneLink.tsx` ใช้ที่ หน้าบันทึกผลสาย/ตารางคิว/หน้าลูกค้า (รายการลูกค้าคงเป็นลิงก์ไปรายละเอียด) · *เล็กมาก*
- ⬜ **จัดลำดับคิวอัจฉริยะ** — เรียงตามมูลค่า/โอกาสกลับมาฝาก · *กลาง*

## 🥉 Tier 3 — รายงาน/วิเคราะห์ให้ดูโปร
- ✅ **กราฟ** (แท่ง/เส้น) — กราฟ SVG server-render เอง (ไม่เพิ่ม dependency): `src/components/charts/TrendChart.tsx` (เส้น+พื้นที่ รายวัน, tooltip `<title>` native) + `BarsH.tsx` (แท่งแนวนอน CSS). หน้า `/reports`: ยอดฝากรายวัน + อัตรารับสายรายวัน + ยอดฝาก/โทรต่อเว็บ (leaderboard) · หน้า `/reports/agents`: leaderboard ตาม sort · ฟังก์ชันข้อมูล `getDailyTrend()` ใน report.ts (เติมวันว่าง=0) · *กลาง* · deploy prod 14 มิ.ย. (dpl_kEa7BW4mTBJTK22kVk5yJosSgqkj)
- ✅ **เทียบช่วงก่อนหน้า** บนหน้า /reports — การ์ด "เทียบกับช่วงก่อนหน้า" (ช่วงก่อน = N วันก่อนหน้าติดกัน, ยาวเท่ากัน) ตาราง ช่วงนี้/ช่วงก่อน + ลูกศร ▲▼ มีสี (ขึ้น=เขียว ลง=แดง) · component `Delta` ในหน้า, helper `dayCount` · ยก logic จาก `deltaLabel` ใน cron มา UI · *เล็ก-กลาง*
- ⬜ **Export รายงานเป็น PDF** / ส่งเข้าอีเมลอัตโนมัติ · *กลาง*
- ⬜ **แดชบอร์ด auto-refresh** · *เล็กมาก*

## Tier 4 — ระบบข้อความ (SMS)
- ⬜ **ส่ง SMS จริงผ่าน gateway** — ตอนนี้ข้อ 11 เป็นแค่ copy-paste template (ต้องมีผู้ให้บริการ/เครดิต) · *ใหญ่*
- ⬜ **ประวัติส่ง SMS + สถานะ delivery** (ขึ้นกับ gateway) · *กลาง*
- ⬜ **สถิติ template ไหนถูกใช้บ่อย + อัตรากลับมาฝาก** · *เล็ก*

## Tier 5 — โปรเจกต์ใหญ่ (ต้องออกแบบเพิ่ม + คุยสเปก)
- 🟡 **ระบบบทบาทละเอียด** (แบบรูปอ้างอิง 8 บทบาท) · *ใหญ่*
    - ✅ **เฟส 1 (วางรากฐาน)**: `src/lib/permissions.ts` (catalog 16 permission + `ROLE_PERMISSIONS` matrix + `roleHas`), เพิ่ม `can()` / `requirePermission()` ใน `auth.ts`, ย้ายทุกจุดเช็คสิทธิ์ (หน้า/action/api/ปุ่ม UI/Sidebar) มาใช้ระบบใหม่ — **พฤติกรรม 3 บทบาทเดิมเหมือนเดิมเป๊ะ** · ลบ `isSupervisor`/`requireSupervisor`/`requireAdmin` ทิ้ง
    - ✅ **สิทธิ์รายคน (override บทบาท) — 15 มิ.ย.**: โมเดล "บทบาท = ค่าตั้งต้น + ติ๊กปรับรายคน". User เพิ่มคอลัมน์ `customPermissions Boolean` + `permissions String[]` (db push แล้ว). `permissions.ts` เพิ่ม `resolvePermissions/normalizePermissionInput/presetFor/listHas` + `PERMISSION_LABELS`/`PERMISSION_GROUPS`. `getSession` resolve สิทธิ์สดทุก request (เปลี่ยนแล้วมีผลทันที), `can()`/`requirePermission()` เช็คจาก `session.permissions`. Sidebar gate ด้วยสิทธิ์ที่ resolve แล้ว. UI: ฟอร์มสร้างผู้ใช้ (`RegisterAdmin`) + ตารางจัดการผู้ใช้ (`RowPermissions`) มีตารางติ๊กสิทธิ์ (`PermissionGrid`, จัดกลุ่ม) — ติ๊กตรง preset = สืบทอดบทบาท, ต่าง = override. **ADMIN = ทุกสิทธิ์เสมอ**. เปลี่ยนบทบาท = ล้าง override คืนค่าตั้งต้น. **ปรับ default SUPERVISOR: ตัด `notification.manage` (ตั้งค่าแจ้งเตือน Telegram) ออก → สงวนให้ ADMIN**. audit `user.permissions_change`. 39 เทสผ่าน (เพิ่ม resolve/normalize), deploy prod (dpl_2Po6yo4d3auDiFHorJLt1cJEmmwq).
    - ⬜ **เฟส 2**: เพิ่ม 8 บทบาทจริง (รอผู้ใช้ส่งรายชื่อ 8 บทบาท + สิทธิ์จากรูปอ้างอิง) → เติม enum `Role` ใน schema.prisma + เติม key ใน `ROLE_PERMISSIONS` + db push
    - 💡 **หมายเหตุ granularity**: `customer.manage` ยังรวม แก้เบอร์/มอบหมาย/**บันทึกฝาก-โบนัส**/เก็บ ไว้ก้อนเดียว — ถ้าอยากให้หัวหน้า "แก้ไขข้อมูลเชิงลึก (ฝาก-โบนัส) ไม่ได้" แยกเฉพาะ ต้องแตก `customer.finance` ออกมาเป็น permission ใหม่
- ⬜ **โครงสร้างทีม** — หัวหน้าเห็นเฉพาะลูกทีมตัวเอง (ตอนนี้เห็นทุกคน) · *กลาง-ใหญ่*
- ⬜ **รวม/จัดการเบอร์ซ้ำ (merge)** + หลายเบอร์ต่อลูกค้า 1 คน · *กลาง*

## Tier 6 — คุณภาพ/ความเรียบร้อย
- ⬜ **Toast แจ้งผล** แทน alert ในหน้า + loading skeleton · *กลาง*
- ⬜ **ปรับ mobile** — ตารางใหญ่ให้เป็นการ์ดบนจอเล็ก · *กลาง*
- ⬜ **ค้นหารวม (global search)** เบอร์/ชื่อ/ผู้ใช้ · *กลาง*
- ⬜ **ตั้งค่าโปรโมชัน** — โปร 20% ตอนนี้ hardcode ควรตั้งค่าได้ · *เล็ก*
- ⬜ **Telegram: ปุ่ม "เปิดดูในระบบ"** ในข้อความ + cron เตือนนัดเกินกำหนด · *เล็ก*
- 🟡 **Error monitoring (Sentry)** + **ชุดทดสอบอัตโนมัติ** (ตอนนี้ทดสอบมือ) · *กลาง*
    - ✅ **ชุดทดสอบ vitest** (`npm test`) — 32 เทส ครอบ logic เสี่ยงสูง: permissions matrix, dates/timezone ไทย (ขอบรายงาน), sms renderTemplate, formatPhone/Money. config `vitest.config.ts` (alias @ + stub server-only), tests ที่ `tests/`
    - ✅ **Error boundary** — `src/app/(app)/error.tsx` (หน้าในแอป + ปุ่มลองใหม่ `unstable_retry` + log digest) + `src/app/global-error.tsx` (root layout พัง, inline style) → prod ไม่ crash หน้าขาว, error เข้า Vercel Function Logs
    - ⬜ **Sentry จริง** — รอ DSN จาก account ผู้ใช้ (เสียบ @sentry/nextjs ภายหลัง)
- ⬜ **ลบผู้ใช้แบบปลอดภัย** (ตอนนี้ทำได้แค่ปิดใช้งาน) · *เล็ก*

---

## 👍 ลำดับแนะนำ (ครั้งถัดไป)
1. **Tier 1 ให้จบ** (✅ confirm dialog · ✅ import history → เหลือ **2FA/TOTP**) = ปิดงานด้านความปลอดภัย/ความถูกต้อง
2. **Tier 2 บางส่วน** (เป้าโทรรายวัน + เตือนนัดส่วนตัว + tel: link) = พนักงานใช้งานลื่นขึ้นทันที
3. **Tier 3 กราฟ** = ผู้บริหารดูรายงานเข้าใจง่ายขึ้น

## ⚠️ หมายเหตุทางเทคนิคที่ต้องระวัง
- **นำเข้าซ้ำ (idempotent) — แก้แล้ว 15 มิ.ย.:** เพิ่มโหมด **replace** (นำเข้าทับ) ทั้งเว็บ + CLI. DepositEvent/BonusAdjustment มีคอลัมน์ `importedAt` (marker ว่ามาจาก import; null=กรอกมือ), CallLog ใช้ `callerId IS NULL` เป็น marker. replace = ลบ event จากการนำเข้าเดิม (ในเดือนของไฟล์ × ลูกค้าในไฟล์ ยกเว้นห้ามโทร) แล้วสร้างใหม่ → re-import ไฟล์เดิมกี่รอบก็ได้ผลเท่ากัน + เก็บยอดใหม่ของลูกค้าเดิมครบ + ไม่แตะสายที่พนักงาน log และยอดที่กรอกมือ. **CLI default = replace** (เดิม append). ทดสอบ DB จริง (`scripts/verify-import-idempotent.ts`): replace 2 รอบ = 2 ฝาก (ไม่ซ้ำ), append = 4 (พิสูจน์ของเดิมซ้ำ). เดือนยัง hardcode มิ.ย. 2026 (YEAR/MONTH ใน import-excel.ts).
- `getSession` query DB ทุก request (แลกกับ revoke ทันที) — ถ้า scale ใหญ่ค่อยพิจารณา cache
- ตั้ง secret บน Vercel ระวัง BOM/newline (เคยทำ prod พัง — ดูบันทึกใน memory)
