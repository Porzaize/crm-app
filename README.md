# CRM โทรติดตามลูกค้า (Win-back Call CRM)

ระบบ CRM สำหรับทีม Call Center โทรติดตามลูกค้าที่หายไป (win-back) ให้กลับมาใช้บริการ/ฝากเงิน — แปลงข้อมูลจาก Excel มาเป็นระบบจัดการคิวโทร มอบหมายงาน บันทึกผลสาย และรายงานผลแบบครบวงจร

🌐 **เว็บใช้งานจริง:** https://crm-app-one-steel.vercel.app

> บัญชีทดลอง (seed): `admin` / `admin1234` · `head1` / `head1234` · `agent1` / `agent1234`

---

## ✨ ฟีเจอร์หลัก

### จัดการลูกค้า & คิวโทร
- คิวโทรประจำวัน + ตัวกรอง (สถานะ/ผู้รับผิดชอบ/นัดหมาย) + คลิกโทร (`tel:` link)
- บันทึกผลสาย (รับ/ไม่รับ/ตัดสาย/ไม่สนใจ ฯลฯ) + นัดโทรกลับ + ส่ง SMS ตาม template
- เพิ่ม/แก้ไขลูกค้า, มอบหมายงานเป็นชุด, บันทึกยอดฝาก-โบนัส, เก็บลูกค้า (soft-delete)
- สถานะลูกค้า: ใช้งาน / หายไป (LAPSED) / ห้ามโทร (Do-Not-Call) พร้อมประวัติการเปลี่ยนสถานะ

### นำเข้าข้อมูล
- นำเข้าไฟล์ Excel ผ่านเว็บ — มี **preview + กันซ้ำ (idempotent)** โหมด replace นำเข้าทับได้ไม่ซ้ำ
- ประวัติการนำเข้า (`/admin/import/history`)

### รายงาน & วิเคราะห์
- แดชบอร์ดสรุป: ลูกค้า/คิว/อัตรารับสาย/ยอดกลับมาฝาก + เป้าโทรรายวันต่อคน (แถบความคืบหน้า)
- รายงานยอดฝาย/อัตรารับสายรายวัน + กราฟ (SVG server-render ไม่พึ่ง dependency)
- เทียบช่วงก่อนหน้า, ผลงานพนักงาน (leaderboard), Cohort analysis
- Export CSV/Excel (ลูกค้า, รายงาน)

### ความปลอดภัย & สิทธิ์
- ล็อกอินด้วย JWT (httpOnly cookie) + bcrypt
- **เปลี่ยนรหัสผ่านเอง** (หน้าโปรไฟล์) → bump tokenVersion เตะ session อื่นออก
- ระบบสิทธิ์ละเอียด (permission catalog) + override รายคน — ADMIN ได้ทุกสิทธิ์เสมอ
- ล็อกบัญชีอัตโนมัติเมื่อกรอกรหัสผิดหลายครั้ง + revoke session
- Audit Log บันทึกทุกการกระทำสำคัญ + ตรวจสอบทุจริต + login audit

### เครื่องมือ
- คลังข้อความ SMS (template กลาง มีตัวแปร {{เว็บ}} {{เบอร์}} {{โปร}})
- แจ้งเตือน Telegram (cron: สรุปรายวัน/สัปดาห์, คิวเช้า, เตือนวันเงียบ)
- จัดการเว็บ (brand), แคมเปญ, ผู้ใช้/แอดมิน

---

## 🛠 เทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, Server Actions) |
| UI | React 19 + CSS เอง (`globals.css`, มีโหมดมืด) |
| Database | PostgreSQL (Supabase, Singapore) ผ่าน Prisma 6 |
| Auth | JWT (`jose`) + `bcryptjs` |
| Excel | `xlsx` |
| Test | Vitest |
| Deploy | Vercel (+ Vercel Cron) |

---

## 🚀 เริ่มต้นใช้งาน (Local)

```bash
npm install

# ตั้งค่า .env (ดู .env.example) — ต้องมี:
#   DATABASE_URL, DIRECT_URL  (Postgres)
#   JWT_SECRET                (สุ่มยาว ๆ)
#   TELEGRAM_BOT_TOKEN, CRON_SECRET  (ถ้าใช้)

npm run db:push      # สร้างตารางตาม schema
npm run seed         # สร้างผู้ใช้ทดลอง (admin/head1/agent1/agent2)
npm run import       # (ถ้ามี) นำเข้าข้อมูลจาก Excel

npm run dev          # http://localhost:3000
```

คำสั่งอื่น:
```bash
npm run build        # prisma generate + next build (production)
npm test             # vitest
```

---

## 📁 โครงสร้างโปรเจกต์

```
src/
  app/
    login/                 หน้าเข้าสู่ระบบ (Server Action)
    (app)/                 ส่วนที่ต้องล็อกอิน (layout = topbar + sidebar)
      page.tsx             แดชบอร์ด
      queue/               คิวโทร + บันทึกผลสาย
      customers/           จัดการลูกค้า
      reports/             รายงาน + agents + cohort
      profile/             โปรไฟล์ + เปลี่ยนรหัสผ่าน
      admin/               ผู้ใช้/เว็บ/แคมเปญ/นำเข้า/SMS/แจ้งเตือน/audit
    api/                   import, export, cron
  lib/                     auth, permissions, db, report, sms, telegram, dates ...
  components/              ConfirmButton, PhoneLink, ProgressBar, charts ...
prisma/schema.prisma       โมเดลฐานข้อมูล
scripts/                   seed, import, utilities (tsx)
tests/                     vitest
```

---

## 🔐 บทบาท (Role)

| บทบาท | เห็น/ทำได้ |
|---|---|
| **AGENT** | คิว/ลูกค้าของตัวเอง, บันทึกผลสาย, เปลี่ยนรหัสตัวเอง |
| **SUPERVISOR** | + รายงาน, ตั้งค่าบางส่วน, ดูผลงานทีม |
| **ADMIN** | ทุกอย่าง (จัดการผู้ใช้/สิทธิ์/เว็บ/แจ้งเตือน/audit) |

> สิทธิ์ปรับละเอียดรายคนได้ (override บทบาท) — ดู `src/lib/permissions.ts`

---

## 📦 Deploy

- **เว็บ:** Vercel — push `main` แล้ว `vercel --prod` (build รัน `prisma generate && next build`)
- **DB:** Supabase (pooler 6543 สำหรับ runtime, 5432 สำหรับ `db push`)
- ค่าลับทั้งหมดอยู่ใน `.env` (local) + Vercel env — **ไม่อยู่ใน repo** (`.env*` ถูก gitignore)

---

## 📋 แผนพัฒนาต่อ

ดู [ROADMAP.md](./ROADMAP.md) — รวมสิ่งที่ทำเสร็จแล้ว + สิ่งที่ยังขาด เรียงตามความสำคัญ (Tier 1–6)

---

## 🎓 การส่งงาน (Homework)

แต่ละงานแตก branch `homework/<เลขข้อ>-<ชื่อสั้น>` จาก `main` แล้วส่งเป็น Pull Request
- ✅ ข้อ 01 — เปลี่ยนรหัสผ่าน → [PR #1](https://github.com/Porzaize/crm-app/pull/1)
