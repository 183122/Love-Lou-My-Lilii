# TeacherTemplate VTR Evidence Hub

**ระบบรวบรวมภาพและวิดีโอประกอบการนิเทศเปิดภาคเรียน**
โรงเรียนบ้านโคกสูง · สพป.ศรีสะเกษ เขต 3 · ภาคเรียนที่ 2 ปีการศึกษา 2569

ครูส่งภาพ/วิดีโอหลักฐานตาม 36 ตัวชี้วัด (7 หมวด) ได้จากมือถือโดยไม่ต้องเข้าสู่ระบบ ไฟล์ถูกจัดเก็บใน Google Drive ของโรงเรียนตามโฟลเดอร์หมวด/ตัวชี้วัดอัตโนมัติ Dashboard แสดงความคืบหน้าจริงจากฐานข้อมูล และผู้ดูแลคัดเลือกไฟล์สำหรับตัดต่อ VTR ได้

## เทคโนโลยี

Next.js 16 (App Router, Route Handlers) · React 19 · TypeScript · Tailwind CSS 4 · คอมโพเนนต์แบบ shadcn/ui (Radix) · Lucide · Framer Motion · Recharts · Supabase PostgreSQL · Google Drive API v3 · Cloudflare Turnstile · **Cloudflare Workers** (OpenNext)

## ฟีเจอร์

| เมนู | สิทธิ์ | รายละเอียด |
|---|---|---|
| Dashboard | สาธารณะ (ปิดได้) | สถิติ 4 การ์ด, Donut chart, Progress ตามหมวด, ส่งล่าสุด, ยังไม่ส่ง, จำนวนรูป/วิดีโอ/VTR, รีเฟรชอัตโนมัติ 30 วิ |
| ส่งหลักฐาน | สาธารณะ + CAPTCHA | หลายไฟล์, Drag & Drop, กล้องมือถือ, ตรวจชนิด/ขนาด, Progress, Retry, อัปโหลดแบบ Resumable |
| ตัวชี้วัดทั้งหมด / ส่งแล้ว / ยังไม่ส่ง | สาธารณะ | ค้นหา กรองหมวด คลิกดูรายละเอียดตัวชี้วัด |
| คลังรูปภาพและวิดีโอ | ผู้ชม (รหัสเข้าถึง) / ผู้ดูแล | Grid/List, Lightbox, เล่นวิดีโอ (Range), ค้นหา กรอง เรียง ดาวน์โหลด |
| คัดเลือกสำหรับ VTR | ผู้ดูแล | เลือก/ยกเลิก จัดลำดับ หมายเหตุผู้ตัดต่อ Manifest CSV/JSON ดาวน์โหลดทีละไฟล์ |
| ตั้งค่าระบบ | ผู้ดูแล | โรงเรียน/ระบบ/ภาคเรียน, Google Drive, Root Folder, หมวด/ตัวชี้วัด/เกณฑ์ขั้นต่ำ, ขนาด/ชนิดไฟล์, จัดการ/ลบหลักฐาน, การแสดงผล, ความปลอดภัย |

สถานะตัวชี้วัด (`NOT_SUBMITTED` / `PARTIAL` / `COMPLETED`) คำนวณจาก **ไฟล์ที่อัปโหลดสำเร็จ** เทียบกับจำนวนรูป/วิดีโอขั้นต่ำ ไม่ใช่จำนวนครั้งที่ส่ง ไฟล์ที่ล้มเหลว ถูกลบ หรือหายจาก Drive ไม่ถูกนับ

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.example .env.local   # กรอกค่า (ดูคู่มือด้านล่าง); สำหรับ wrangler ใช้ .dev.vars รูปแบบเดียวกัน
npm run dev
```

คู่มือ:
1. [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) — สร้างฐานข้อมูล รัน Migration และ Seed
2. [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md) — Google Cloud, Drive API, OAuth, Redirect URI, เชื่อม Drive
3. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — ตั้งค่า Secrets, Deploy บน Cloudflare Workers, ทดสอบระบบจริง
4. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — การออกแบบการอัปโหลด ความปลอดภัย และข้อจำกัดของแพลตฟอร์ม
5. [docs/TESTING.md](docs/TESTING.md) — ชุดทดสอบและการแมปกับรายการทดสอบ 30 ข้อ

## คำสั่ง

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` / `build` / `start` | พัฒนา / build / รัน production |
| `npm run typecheck` / `lint` | ตรวจ TypeScript / ESLint |
| `npm test` | Unit + Integration (รวมรัน SQL migration จริงบน PGlite) |
| `npm run test:e2e` | Playwright E2E (desktop + mobile) บน `next start` ต้อง `npm run build` ก่อน |
| `npm run cf:build` / `cf:preview` / `cf:deploy` | build สำหรับ Cloudflare / ทดลองใน wrangler / deploy |
| `npm run test:e2e:cf` | E2E ชุดเดียวกันใน Cloudflare Workers runtime (workerd) ต้อง `npm run cf:build` ก่อน |
| `npm run test:drive-live` | ทดสอบกับ Google Drive จริง (ต้องมี GOOGLE_* credentials) |
| `npm run hash-password -- "รหัสผ่าน"` | สร้าง `ADMIN_PASSWORD_HASH` |
| `npm run seed:generate` | สร้าง `supabase/seed.sql` ใหม่จาก `src/data/indicators.ts` |

## โครงสร้าง

```
src/app/                 หน้าเว็บ + api/ (Route Handlers)
src/components/          UI (layout, dashboard, gallery, settings, submit, ui/)
src/lib/shared/          โค้ดที่ใช้ร่วม client/server (ตรวจไฟล์, สถานะ, manifest)
src/lib/server/          โค้ดฝั่งเซิร์ฟเวอร์เท่านั้น (db, drive, auth, uploads, ...)
src/data/indicators.ts   ข้อมูลตั้งต้น 7 หมวด 36 ตัวชี้วัด
supabase/migrations/     SQL Migration
supabase/seed.sql        Seed (generated)
tests/                   unit, integration, e2e, live
legacy/                  ไฟล์เว็บเดิมของ repository (ไม่เกี่ยวกับระบบนี้)
```
