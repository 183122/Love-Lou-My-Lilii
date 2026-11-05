import { expect, test } from "@playwright/test";
import { fillSubmission, fixture } from "./helpers";

// Test 22: mobile
test("22. mobile: bottom navigation and submitting evidence from a phone", async ({ page }) => {
  await page.goto("/");
  const bottom = page.getByRole("navigation", { name: "เมนูด้านล่าง" });
  await expect(bottom).toBeVisible();
  await expect(page.getByTestId("stat-ตัวชี้วัดทั้งหมด")).toHaveText("36");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await bottom.getByRole("link", { name: "ส่งหลักฐาน" }).click();
  await expect(page).toHaveURL(/\/submit$/);
  // no horizontal overflow on phone width
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(page.getByRole("button", { name: "ถ่ายภาพ" })).toBeVisible();
  await expect(page.locator('input[capture="environment"][accept="image/*"]')).toHaveCount(1);

  await fillSubmission(page, { category: "E. นักเรียนมีความสุข", indicator: "E01 นักเรียนเรียนรู้อย่างมีความสุข มีสุขภาวะที่ดี", title: "กิจกรรมยามเช้า" });
  await page.getByTestId("file-input").setInputFiles([fixture("sample.jpg")]);
  await page.getByRole("button", { name: "ส่งหลักฐาน", exact: true }).click();
  await expect(page.getByTestId("upload-summary")).toHaveText("อัปโหลดสำเร็จ 1 จาก 1 ไฟล์");

  await page.getByRole("button", { name: "เปิดเมนู" }).click();
  await expect(page.getByRole("link", { name: "คัดเลือกสำหรับ VTR" })).toBeVisible();
});
