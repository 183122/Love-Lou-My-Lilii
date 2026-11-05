import { expect, test } from "@playwright/test";
import { fillSubmission, fixture, injectDrive, loginAdmin } from "./helpers";

test.describe.configure({ mode: "serial" });

test("1–2. dashboard and indicator list load real data (36 indicators)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("TEST MODE")).toBeVisible();
  await expect(page.getByTestId("stat-ตัวชี้วัดทั้งหมด")).toHaveText("36");
  await expect(page.getByTestId("stat-ยังไม่ส่ง")).toHaveText("36");
  await page.goto("/indicators");
  await expect(page.getByTestId("indicator-count")).toHaveText("แสดง 36 รายการ");
});

test("8–9. client-side validation rejects wrong type and oversize file", async ({ page }) => {
  await page.goto("/submit");
  await page.getByTestId("file-input").setInputFiles([
    { name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") },
    { name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(21 * 1024 * 1024, 0xff) },
  ]);
  const statuses = page.getByTestId("file-status");
  await expect(statuses.nth(0)).toContainText("ไม่รองรับไฟล์");
  await expect(statuses.nth(1)).toContainText("เกินกำหนด");
  await page.getByRole("button", { name: "ส่งหลักฐาน", exact: true }).click();
  await expect(page.getByText("กรุณาเลือกหมวดการนิเทศ")).toBeVisible();
  await expect(page.getByText("มีไฟล์ที่ไม่ผ่านการตรวจสอบ")).toBeVisible();
});

test("3–7, 10–13. submit image + video without login, upload to Drive, dashboard updates", async ({ page }) => {
  await fillSubmission(page, { category: "A. การบริหารงานทั่วไป", indicator: "A07 ระบบเครือข่ายอินเทอร์เน็ตพร้อมใช้งาน", title: "ทดสอบเครือข่าย" });
  await expect(page.getByText("หลักฐานที่แนะนำ")).toBeVisible();
  await page.getByTestId("file-input").setInputFiles([fixture("sample.png"), fixture("sample.jpg"), fixture("sample.webm")]);
  await expect(page.getByTestId("file-card")).toHaveCount(3);
  await page.getByRole("button", { name: "ส่งหลักฐาน", exact: true }).click();
  await expect(page.getByTestId("upload-summary")).toHaveText("อัปโหลดสำเร็จ 3 จาก 3 ไฟล์");

  await page.goto("/");
  await expect(page.getByTestId("stat-รูปภาพทั้งหมด")).toHaveText("2");
  await expect(page.getByTestId("stat-วิดีโอทั้งหมด")).toHaveText("1");
  await expect(page.getByTestId("stat-ยังไม่ส่ง")).toHaveText("35");
  await expect(page.getByRole("link", { name: /A07 ระบบเครือข่าย/ }).first()).toBeVisible();
});

test("19. pending page lists indicators not yet submitted", async ({ page }) => {
  await page.goto("/pending");
  await expect(page.getByTestId("indicator-count")).toHaveText("แสดง 35 รายการ");
  await expect(page.getByRole("link", { name: /A01 ประชุมครูก่อนเปิดภาคเรียน/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /A07 / })).toHaveCount(0); // A07 completed (2 images, 0 video required)
});

test("21. admin pages and evidence are protected", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("เข้าสู่ระบบผู้ดูแล")).toBeVisible();
  expect((await page.request.get("/api/admin/settings")).status()).toBe(401);
  expect((await page.request.get("/api/files")).status()).toBe(401);
  await page.goto("/gallery");
  await expect(page.getByText("กรอกรหัสเข้าถึงคลังหลักฐาน")).toBeVisible();
});

test("14–17. gallery: open image, play video, download", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-count")).toContainText("3 ไฟล์");
  await page.getByRole("combobox", { name: "ประเภทไฟล์" }).selectOption("IMAGE");
  await page.getByTestId("gallery-item").first().click();
  const img = page.getByTestId("lightbox-image");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(320);
  await page.keyboard.press("Escape");

  await page.getByRole("combobox", { name: "ประเภทไฟล์" }).selectOption("VIDEO");
  await page.getByTestId("gallery-item").first().click();
  const video = page.getByTestId("lightbox-video");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(1);
  await video.evaluate((v: HTMLVideoElement) => {
    v.muted = true;
    return v.play();
  });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "ดาวน์โหลด" }).click()]);
  expect(download.suggestedFilename()).toBe("sample.webm");
});

test("18. VTR selection workspace and manifest", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/vtr");
  await page.getByTestId("vtr-select").first().click();
  await expect(page.getByTestId("vtr-selected").locator("li")).toHaveCount(1);
  await page.getByTestId("vtr-select").first().click();
  await expect(page.getByTestId("vtr-selected").locator("li")).toHaveCount(2);
  const note = page.getByLabel("หมายเหตุสำหรับผู้ตัดต่อ").first();
  await note.fill("ใช้เป็นภาพเปิด");
  await note.blur();
  await expect(page.getByText("บันทึกหมายเหตุแล้ว")).toBeVisible();
  await page.getByRole("button", { name: "เลื่อนลง" }).first().click();
  const csv = await (await page.request.get("/api/admin/vtr/manifest?format=csv")).text();
  expect(csv).toContain("ลำดับ,หมวด,ตัวชี้วัด");
  expect(csv.trim().split("\r\n")).toHaveLength(3);
  expect(csv).toContain("ใช้เป็นภาพเปิด");
});

test("20. admin edits an indicator", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/settings?tab=indicators");
  await page.getByRole("button", { name: "แก้ไข A01" }).click();
  await page.getByLabel("ชื่อตัวชี้วัด").fill("ประชุมครูก่อนเปิดภาคเรียน (ปรับปรุง)");
  await page.getByLabel("รูปภาพขั้นต่ำ").fill("1");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("บันทึกตัวชี้วัดแล้ว")).toBeVisible();
  await page.goto("/indicators");
  await expect(page.getByText("ประชุมครูก่อนเปิดภาคเรียน (ปรับปรุง)")).toBeVisible();
});

test("23–24, 27, 29. failed upload is not marked successful; retry resumes and succeeds", async ({ page }) => {
  await fillSubmission(page, { category: "B. การบริหารงานวิชาการ", indicator: "B11 การใช้ OBEC Content Center", title: "ทดสอบล้มเหลว" });
  await page.getByTestId("file-input").setInputFiles([fixture("sample.png")]);
  // Drive accepts the submission, then the network to Drive drops on every chunk attempt
  await page.route("**/api/uploads/**", async (route) => {
    if (route.request().method() === "PUT") return route.abort("internetdisconnected");
    return route.continue();
  });
  await page.getByRole("button", { name: "ส่งหลักฐาน", exact: true }).click();
  await expect(page.getByTestId("upload-summary")).toHaveText("อัปโหลดสำเร็จ 0 จาก 1 ไฟล์", { timeout: 60_000 });
  await expect(page.getByTestId("file-status")).toContainText("อัปโหลดไม่สำเร็จ");
  await page.unroute("**/api/uploads/**");

  // Server-side failure: Drive loses write permission
  await injectDrive(page, { forbidden: true });
  await page.getByRole("button", { name: "ลองใหม่" }).click();
  await expect(page.getByTestId("file-status")).toContainText("ไม่มีสิทธิ์เขียน");
  await injectDrive(page, { forbidden: false });

  await page.getByRole("button", { name: "ลองใหม่" }).click();
  await expect(page.getByTestId("upload-summary")).toHaveText("อัปโหลดสำเร็จ 1 จาก 1 ไฟล์");
});

test("26. expired Google token shows an actionable message", async ({ page }) => {
  await injectDrive(page, { tokenRevoked: true });
  await fillSubmission(page, { category: "C. การบริหารงานงบประมาณ", indicator: "C02 การจัดอาหารเสริม (นม)", title: "นม" });
  await page.getByTestId("file-input").setInputFiles([fixture("sample.jpg")]);
  await page.getByRole("button", { name: "ส่งหลักฐาน", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "หมดอายุหรือถูกเพิกถอน" })).toBeVisible();
  await injectDrive(page, { tokenRevoked: false });
});

test("28. file deleted in Drive is detected and status recalculated", async ({ page }) => {
  await loginAdmin(page);
  const files = (await (await page.request.get("/api/admin/files")).json()) as { items: { id: string; indicator: { code: string }; status: string }[] };
  const b11 = files.items.find((f) => f.indicator.code === "B11" && f.status === "UPLOADED")!;
  await injectDrive(page, { removeEvidenceId: b11.id });
  await page.goto("/settings?tab=evidence");
  await page.getByRole("button", { name: "ตรวจสอบไฟล์กับ Google Drive" }).click();
  await expect(page.getByText(/ไม่พบใน Drive 1 ไฟล์/)).toBeVisible();
  const dash = (await (await page.request.get("/api/dashboard")).json()) as { indicators: { code: string; status: string }[] };
  expect(dash.indicators.find((i) => i.code === "B11")!.status).toBe("NOT_SUBMITTED");
});
