# Testing

```bash
npm test               # unit + integration (Vitest)
npm run build && npm run test:e2e   # Playwright: desktop Chrome + Pixel 7
npm run test:drive-live             # Google Drive จริง (ต้องมี credentials)
```

- **Unit** (`tests/unit`): สถานะตัวชี้วัด, ตรวจชนิด/ขนาดไฟล์, magic bytes, crypto, Google Drive client (mock `fetch`), seed, manifest
- **Integration** (`tests/integration`):
  - `migration.test.ts` รัน **SQL migration + seed จริง** บน PostgreSQL แบบฝัง (PGlite) ตรวจตาราง, UUID PK, RLS, สิทธิ์ anon, constraints, view, rate limit
  - `api.test.ts` เรียก **Route Handlers จริง** กับ in-memory repo + FakeDrive (mock เฉพาะในการทดสอบ)
- **E2E** (`tests/e2e`): เบราว์เซอร์จริงกับ production build ในโหมด `VTR_TEST_BACKENDS=1` (แสดงแถบ TEST MODE)
- **Live** (`tests/live`): Google Drive API จริง — ข้ามอัตโนมัติถ้าไม่มี credentials

| # | รายการ | ทดสอบที่ |
|---|---|---|
| 1 | โหลด Dashboard | api: *loads dashboard*; e2e 1–2 |
| 2 | ตัวชี้วัดครบ 36 | unit seed; migration; e2e 1–2 |
| 3–4 | เลือกหมวด/ตัวชี้วัด | e2e 3–7 |
| 5 | กรอกข้อมูลผู้ส่ง | api: *validates required form fields*; e2e |
| 6–7 | แนบรูป/วิดีโอ | api: *uploads an image and a multi-chunk video*; e2e |
| 8 | ขนาดไฟล์ | unit files; api oversize; e2e 8–9 |
| 9 | ชนิดไฟล์ | unit files/magic bytes; api content sniffing; e2e 8–9 |
| 10 | อัปโหลดไป Drive | api (FakeDrive); unit Drive protocol; live |
| 11 | สร้างโฟลเดอร์อัตโนมัติ | api: folder reuse, folder tree idempotent |
| 12 | บันทึก File ID | api |
| 13 | อัปเดต Dashboard | api; e2e |
| 14–17 | Gallery / รูป / วิดีโอ / ดาวน์โหลด | api (Range 206, Content-Disposition); e2e 14–17 (เล่นวิดีโอจริง) |
| 18 | คัดเลือก VTR | api manifest; e2e 18 |
| 19 | ยังไม่ส่ง | e2e 19 |
| 20 | แก้ไขตัวชี้วัด | api; e2e 20 |
| 21 | ป้องกัน Admin | api authorization/CSRF/rate limit; e2e 21 |
| 22 | มือถือ | e2e mobile (Pixel 7) |
| 23 | อัปโหลดล้มเหลว | api forbidden mid-upload; e2e 23–24 |
| 24 | Retry | api resume; e2e retry |
| 25 | ส่งซ้ำ | api idempotent / re-send chunk |
| 26 | Token หมดอายุ | unit invalid_grant; api; e2e 26 |
| 27 | ไม่มีสิทธิ์เขียน | unit 403; api; e2e |
| 28 | ไฟล์ถูกลบจาก Drive | api MISSING; e2e 28 |
| 29 | เน็ตหลุดระหว่างอัปโหลด | api network drop + resume; e2e (route abort) |
| 30 | คำนวณสถานะ | unit status; api |
