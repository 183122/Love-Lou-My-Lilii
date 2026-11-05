import { describe, expect, it } from "vitest";
import { buildManifestCsv, csvCell, sortVtr } from "@/lib/shared/manifest";

describe("VTR manifest", () => {
  it("builds CSV with BOM and Thai headers", () => {
    const csv = buildManifestCsv([
      { order: 1, category: "A. ทั่วไป", indicator: "A01 ประชุมครู", activity: 'ประชุม "ครู", ภาคเรียน', file_name: "a.jpg", file_type: "รูปภาพ", note: "ใช้เปิดเรื่อง" },
    ]);
    expect(csv.startsWith("\uFEFFลำดับ,หมวด,ตัวชี้วัด,ชื่อกิจกรรม,ชื่อไฟล์,ประเภทไฟล์,หมายเหตุ\r\n")).toBe(true);
    expect(csv).toContain('"ประชุม ""ครู"", ภาคเรียน"');
  });
  it("neutralises spreadsheet formula injection", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
  });
  it("sorts by vtr_order then created_at", () => {
    const r = sortVtr([
      { id: "b", vtr_order: 2, created_at: "1" },
      { id: "c", vtr_order: null, created_at: "0" },
      { id: "a", vtr_order: 1, created_at: "2" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
