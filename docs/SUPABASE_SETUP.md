# Supabase Setup Guide

## 1. สร้าง Supabase Project
1. ไปที่ https://supabase.com/dashboard → **New project**
2. เลือก Region ใกล้ผู้ใช้ (แนะนำ **Southeast Asia (Singapore)**) ตั้งรหัสผ่านฐานข้อมูลที่คาดเดายาก
3. รอจนสถานะเป็น Healthy

## 2. รัน SQL Migration
1. เมนู **SQL Editor** → New query
2. คัดลอกเนื้อหา `supabase/migrations/20261105000000_init.sql` ทั้งไฟล์ → **Run**
3. เปิด query ใหม่ คัดลอก `supabase/seed.sql` → **Run** (รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ)

ตรวจสอบ:
```sql
select (select count(*) from categories) as categories, (select count(*) from indicators) as indicators;
-- ต้องได้ 7 และ 36
```

หรือใช้ Supabase CLI: `supabase link --project-ref <ref>` แล้ว `supabase db push` และรัน seed ผ่าน `psql`

## 3. คีย์ที่ต้องใช้
**Project Settings → API**
- `Project URL` → `SUPABASE_URL`
- `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ ห้ามใช้ service_role key ในโค้ดฝั่ง Browser ระบบนี้ใช้คีย์นี้เฉพาะใน Route Handlers (`src/lib/server/**` มี `import "server-only"` ป้องกันการ bundle ไปฝั่ง client) ไม่จำเป็นต้องใช้ anon key เลย

## ความปลอดภัยของฐานข้อมูล
- เปิด **Row Level Security ทุกตาราง** และ**ไม่มี policy** ให้ `anon`/`authenticated` → เรียก REST API ของ Supabase โดยตรงด้วย anon key จะอ่าน/เขียนอะไรไม่ได้
- `revoke all` จาก `anon`, `authenticated` ทุกตาราง
- การเขียนทั้งหมดผ่าน Server API ที่ตรวจสิทธิ์ + validate ด้วย zod
- Refresh token ของ Google เก็บแบบเข้ารหัส AES-256-GCM ใน `system_settings` (`is_secret = true`)
- เก็บเฉพาะ SHA-256 ของ session token และ IP แบบ hash

## ตาราง
| ตาราง | หน้าที่ |
|---|---|
| `categories` | 7 หมวด |
| `indicators` | 36 ตัวชี้วัด + เกณฑ์รูป/วิดีโอขั้นต่ำ |
| `submissions` | การส่ง 1 ครั้ง (ข้อมูลผู้ส่ง/กิจกรรม) |
| `evidence_files` | ไฟล์แต่ละไฟล์ + Drive File ID + สถานะ + ข้อมูล VTR |
| `drive_folders` | Folder ID จริงของ root/หมวด/ตัวชี้วัด (ป้องกันสร้างซ้ำ) |
| `system_settings` | การตั้งค่า (key/value) |
| `admin_sessions` | เซสชันผู้ดูแลและผู้ชม |
| `rate_limits` | ตัวนับ Rate limit ร่วมกันทุก serverless instance |
