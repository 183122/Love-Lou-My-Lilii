import { expect, type Page } from "@playwright/test";

export const ADMIN_PASSWORD = "e2e-admin-password-123";
export const fixture = (name: string) => `tests/e2e/fixtures/${name}`;

export async function loginAdmin(page: Page) {
  await page.goto("/access");
  await page.getByRole("button", { name: "เข้าสู่ระบบในฐานะผู้ดูแล" }).click();
  await page.getByLabel("รหัสผ่านผู้ดูแล").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.getByText("คุณเข้าสู่ระบบแล้วในฐานะ ผู้ดูแลระบบ")).toBeVisible();
}

export async function fillSubmission(page: Page, opts: { category: string; indicator: string; title: string }) {
  await page.goto("/submit");
  await page.getByLabel("หมวดการนิเทศ *").selectOption({ label: opts.category });
  await page.getByLabel("ตัวชี้วัด *").selectOption({ label: opts.indicator });
  await page.getByLabel("ชื่อผู้ส่ง *").fill("ครูทดสอบ อัตโนมัติ");
  await page.getByLabel("ตำแหน่ง *").fill("ครู");
  await page.getByLabel("ชื่อกิจกรรม *").fill(opts.title);
  await page.getByLabel("รายละเอียดกิจกรรม").fill("รายละเอียดจากการทดสอบ E2E");
}

export async function injectDrive(page: Page, body: Record<string, unknown>) {
  const res = await page.request.post("/api/test/drive", { data: body });
  expect(res.ok()).toBe(true);
}
