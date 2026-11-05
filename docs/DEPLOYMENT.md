# Deployment Guide (Vercel)

## ลำดับขั้นตอน
1. **Supabase** — สร้างโปรเจกต์ + รัน migration + seed → [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
2. **Google Cloud** — เปิด Drive API, Consent screen, OAuth client → [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md)
3. **Cloudflare Turnstile** — https://dash.cloudflare.com → Turnstile → Add widget (Managed) ใส่โดเมน → ได้ Site key / Secret key
4. **สร้างค่าลับ**
   ```bash
   npm run hash-password -- "รหัสผ่านผู้ดูแลที่แข็งแรง"   # → ADMIN_PASSWORD_HASH
   openssl rand -hex 32                                   # → SESSION_SECRET
   ```
5. **Vercel** — https://vercel.com/new → Import repository นี้ (Framework: Next.js, ค่า build เริ่มต้น)
6. **Environment Variables** (Production) ใส่ตาม `.env.example`:

   | ตัวแปร | จำเป็น |
   |---|---|
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✅ |
   | `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | ✅ |
   | `NEXT_PUBLIC_APP_URL` (เช่น `https://vtr-kokesung.vercel.app`) | ✅ |
   | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | ✅ (หรือปิด “บังคับ CAPTCHA” ในตั้งค่า) |
   | `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `GOOGLE_DRIVE_SCOPE`, `TOKEN_ENCRYPTION_KEY`, `VIEWER_ACCESS_CODE_HASH` | ไม่บังคับ |

   ⛔ ห้ามตั้ง `VTR_TEST_BACKENDS` ใน Production (ระบบปฏิเสธโหมดทดสอบบน Vercel อยู่แล้ว)
7. **Deploy** แล้วนำโดเมนที่ได้ไปใส่ใน `NEXT_PUBLIC_APP_URL` และ Redirect URI ของ Google → Redeploy
8. **เชื่อม Google Drive** ใน `/settings` → Google Drive → เชื่อมต่อ → สร้างโครงสร้างโฟลเดอร์
9. ตั้ง **รหัสเข้าถึงผู้ชม** (ตั้งค่า › ความปลอดภัย) สำหรับผู้ที่ต้องดูคลังหลักฐาน

## ข้อจำกัดของ Vercel ที่ออกแบบรองรับแล้ว
- Request body สูงสุด 4.5 MB → ไฟล์ถูกแบ่งเป็น chunk 3.75 MiB ส่งผ่าน `/api/uploads/[id]` ไปยัง Google Drive Resumable Upload (วิดีโอ 500 MB ≈ 134 คำขอ)
- ระยะเวลาฟังก์ชัน: chunk ใช้ `maxDuration = 60`, การสตรีมไฟล์ใช้ `maxDuration = 300` (แผน Hobby ที่เปิด Fluid compute รองรับ 300 วินาที) — วิดีโอขนาดใหญ่บนเครือข่ายช้าอาจโหลดเกินเวลา ให้ดาวน์โหลดผ่าน Google Drive โดยตรงแทน
- ไม่สร้าง ZIP บนเซิร์ฟเวอร์ (ดู ARCHITECTURE.md)

## ทดสอบระบบจริงหลัง Deploy (Checklist)
- [ ] เปิด `/` เห็น “ตัวชี้วัดทั้งหมด 36” ไม่มีแถบ TEST MODE
- [ ] `/settings` → Google Drive แสดง “เชื่อมต่อแล้ว: <อีเมล>” และโฟลเดอร์ 43/44
- [ ] ส่งหลักฐานจากมือถือ (รูป 1 + วิดีโอ 1) ได้ “อัปโหลดสำเร็จ 2 จาก 2 ไฟล์”
- [ ] ไฟล์อยู่ใน Drive โฟลเดอร์ตัวชี้วัดที่ถูกต้อง
- [ ] Dashboard ตัวเลขรูป/วิดีโอเพิ่มขึ้น
- [ ] `/gallery` เปิดรูป เล่นวิดีโอ ดาวน์โหลดได้
- [ ] `/vtr` เลือกไฟล์ ดาวน์โหลด Manifest
- [ ] เรียก `/api/files` แบบไม่ login ได้ 401
- [ ] รัน `npm run test:drive-live` ด้วย credentials จริง ผ่าน

## หากไม่มีสิทธิ์บัญชี
การสร้าง Supabase project, Google Cloud OAuth client, Turnstile และ Vercel project ต้องทำโดยเจ้าของบัญชีโรงเรียน ระบบนี้ไม่มี URL production จนกว่าจะ Deploy ตามขั้นตอนด้านบน
