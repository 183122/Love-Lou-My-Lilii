# Deployment Guide (Cloudflare Workers)

ระบบ deploy บน **Cloudflare Workers** ผ่าน [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`) — Next.js ทั้งหน้าเว็บและ API ทำงานใน Worker เดียว ไฟล์ static เสิร์ฟจาก Workers Assets

> **แผนที่ต้องใช้: Workers Paid ($5/เดือน)** — แผน Free จำกัดเวลา CPU 10 ms ต่อคำขอ ซึ่งไม่พอสำหรับการตรวจรหัสผ่านแบบ scrypt (ประมาณ 30–60 ms) และการส่งต่อ chunk ไฟล์ขนาด 3.75 MB ไปยัง Google Drive แผน Paid ให้ CPU 30 วินาทีต่อคำขอ (เวลารอเครือข่าย เช่น รอ Google Drive ไม่นับเป็น CPU)

## ลำดับขั้นตอน
1. **Supabase** — รัน `supabase/install.sql` ใน SQL Editor → [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
2. **Google Cloud** — เปิด Drive API, Consent screen, OAuth client → [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md)
3. **Cloudflare Turnstile** — Dashboard → Turnstile → Add widget (Managed) ใส่โดเมนของ Worker → ได้ Site key / Secret key
4. **สร้างค่าลับ**
   ```bash
   npm run hash-password -- "รหัสผ่านผู้ดูแลที่แข็งแรง"   # → ADMIN_PASSWORD_HASH
   openssl rand -hex 32                                   # → SESSION_SECRET
   ```
5. **ตั้งชื่อ Worker / URL** — แก้ `wrangler.jsonc`:
   - `name` (ค่าเริ่มต้น `vtr-evidence-hub`; ถ้าเปลี่ยน ให้เปลี่ยน `services[0].service` ให้ตรงกันด้วย)
   - `vars.NEXT_PUBLIC_APP_URL` = `https://vtr-evidence-hub.<subdomain>.workers.dev` หรือโดเมนของโรงเรียน (ไม่มี `/` ท้าย)
6. **ล็อกอินและใส่ Secrets** (ครั้งแรกครั้งเดียว)
   ```bash
   npx wrangler login
   for k in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
            ADMIN_PASSWORD_HASH SESSION_SECRET TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY; do
     npx wrangler secret put $k
   done
   # ไม่บังคับ: GOOGLE_REFRESH_TOKEN GOOGLE_DRIVE_ROOT_FOLDER_ID TOKEN_ENCRYPTION_KEY VIEWER_ACCESS_CODE_HASH
   ```
   (หรือใส่ผ่าน Dashboard → Workers & Pages → vtr-evidence-hub → Settings → Variables and Secrets โดยเลือกชนิด **Secret**)

   ⛔ ห้ามตั้ง `VTR_TEST_BACKENDS` / `VTR_TEST_ALLOW_WORKERD` ใน production (ระบบปฏิเสธโหมดทดสอบบน URL https อยู่แล้ว)
7. **Deploy**
   ```bash
   npm ci
   npm run cf:deploy        # = opennextjs-cloudflare build && opennextjs-cloudflare deploy
   ```
   หรือเชื่อม GitHub อัตโนมัติ: Dashboard → Workers & Pages → Create → **Import a repository** → เลือก repo นี้
   - Build command: `npm run build` (ค่าเริ่มต้น — สคริปต์นี้รัน `opennextjs-cloudflare build` ซึ่งสร้างโฟลเดอร์ `.open-next/`)
   - Deploy command: `npx wrangler deploy` (ค่าเริ่มต้น) หรือ `npx opennextjs-cloudflare deploy`
   - หากเห็น `ERROR Could not find compiled Open Next config, did you run the build command?` แปลว่า build command ไม่ได้รัน OpenNext — ตรวจ Settings → Build → Build command
8. นำ URL จริงไปใส่ใน **Authorized redirect URI** ของ Google: `https://<URL>/api/admin/drive/callback`
9. **เชื่อม Google Drive** ที่ `/settings` → Google Drive → เชื่อมต่อ → สร้างโครงสร้างโฟลเดอร์
10. ตั้ง **รหัสเข้าถึงผู้ชม** (ตั้งค่า › ความปลอดภัย)

### โดเมนของโรงเรียน (ไม่บังคับ)
ถ้าโดเมนอยู่บน Cloudflare: Worker → Settings → Domains & Routes → Add Custom Domain แล้วเปลี่ยน `NEXT_PUBLIC_APP_URL`, Turnstile hostname และ Google Redirect URI ให้ตรงกัน

## ข้อจำกัดของ Cloudflare Workers ที่ออกแบบรองรับแล้ว
| ข้อจำกัด | การรองรับ |
|---|---|
| Request body ≤ 100 MB, หน่วยความจำ 128 MB | ไฟล์แบ่งเป็น chunk 3.75 MiB ส่งต่อเข้า Google Drive Resumable Upload (วิดีโอ 500 MB ≈ 134 คำขอ) ไม่ buffer ทั้งไฟล์ |
| CPU time ต่อคำขอ | ต้องใช้ Workers Paid (ดูด้านบน) |
| ไม่มีระบบไฟล์ / ไม่มี process ค้าง | ใช้ Supabase เก็บสถานะ, rate limit อยู่ใน Postgres ใช้ร่วมทุก isolate |
| ZIP ขนาดใหญ่ | ไม่สร้างบน Worker — ดาวน์โหลดทีละไฟล์ + Manifest (ดู ARCHITECTURE.md) |
| Subrequest ≤ 1,000 ต่อคำขอ (Paid) | ปุ่ม “ตรวจสอบไฟล์กับ Google Drive” เรียก Drive 1 ครั้งต่อไฟล์ — รองรับประมาณ 900 ไฟล์ต่อการกด 1 ครั้ง (การใช้งานปกติไม่ได้รับผลกระทบ) |
| สตรีมวิดีโอ | ส่งต่อแบบ stream พร้อม Range ไม่จำกัดเวลารอ I/O |

## ทดสอบก่อน Deploy
```bash
npm run cf:build
npm run test:e2e:cf     # รันชุด E2E ทั้งหมดใน workerd (runtime จริงของ Cloudflare) ผ่าน wrangler dev
npm run cf:preview      # เปิดดูเองที่ http://localhost:8787 (ใช้ค่าจาก .dev.vars)
```

## ทดสอบระบบจริงหลัง Deploy (Checklist)
- [ ] เปิด `/` เห็น “ตัวชี้วัดทั้งหมด 36” และไม่มีแถบ TEST MODE
- [ ] `/settings` → Google Drive แสดง “เชื่อมต่อแล้ว: <อีเมล>” และโฟลเดอร์ 43/44
- [ ] ส่งหลักฐานจากมือถือ (รูป 1 + วิดีโอ 1) ได้ “อัปโหลดสำเร็จ 2 จาก 2 ไฟล์”
- [ ] ไฟล์อยู่ใน Drive โฟลเดอร์ตัวชี้วัดที่ถูกต้อง และ Dashboard ตัวเลขเพิ่มขึ้น
- [ ] `/gallery` เปิดรูป เล่นวิดีโอ ดาวน์โหลดได้ · `/vtr` ดาวน์โหลด Manifest ได้
- [ ] เรียก `/api/files` แบบไม่ login ได้ 401
- [ ] `npm run test:drive-live` ด้วย credentials จริงผ่าน
- [ ] ดู log ได้ที่ Dashboard → Worker → Logs (เปิด observability ไว้แล้วใน wrangler.jsonc) หรือ `npx wrangler tail`

## หากไม่มีสิทธิ์บัญชี
การสร้าง Supabase project, Google OAuth client, Turnstile widget และ Cloudflare Worker ต้องทำโดยเจ้าของบัญชีของโรงเรียน ระบบนี้ยังไม่มี URL production จนกว่าจะ deploy ตามขั้นตอนข้างต้น

## แก้ปัญหาการ Deploy บน Cloudflare
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| เปิดเว็บแล้วเห็น `Hello world` | ยังเป็นโค้ดตัวอย่างที่ Cloudflare สร้างตอนสร้าง Worker — โค้ดระบบยังไม่ถูก deploy ดูแท็บ Deployments |
| Build log แสดง `> next build` และมีแค่ route `/` | Worker ผูกกับ repo ตัวอย่าง (เช่น `next-starter-template`) — Settings → Build → Git repository → Disconnect แล้ว Connect `Love-Lou-My-Lilii` |
| `ERROR Could not find compiled Open Next config` | Build command ไม่ได้รัน OpenNext — ใช้ `npm run build` ของ repo นี้ (ซึ่งรัน `opennextjs-cloudflare build`) |
| ไม่มีปุ่มสั่ง build ใหม่ | push commit ใหม่เข้า Production branch ที่ตั้งไว้ จะ build อัตโนมัติ หรือ deploy จากเครื่องด้วย `npm run cf:deploy` |
| หน้าเว็บขึ้น “ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล” | ขาด secret `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` หรือยังไม่ได้รัน `supabase/install.sql` |
