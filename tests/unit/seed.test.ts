import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED_CATEGORIES, SEED_INDICATORS } from "@/data/indicators";
import { buildSeedSql } from "@/data/seed-sql";

// Test 2: 36 indicators in 7 categories
describe("seed data", () => {
  it("has 7 categories A–G and 36 indicators", () => {
    expect(SEED_CATEGORIES.map((c) => c.code)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(SEED_INDICATORS).toHaveLength(36);
    const per = Object.fromEntries(SEED_CATEGORIES.map((c) => [c.code, SEED_INDICATORS.filter((i) => i.categoryCode === c.code).length]));
    expect(per).toEqual({ A: 7, B: 11, C: 4, D: 4, E: 2, F: 4, G: 4 });
  });
  it("has unique codes in the expected format", () => {
    const codes = SEED_INDICATORS.map((i) => i.code);
    expect(new Set(codes).size).toBe(36);
    codes.forEach((c) => expect(c).toMatch(/^[A-G]\d{2}$/));
    expect(codes).toContain("B11");
    expect(SEED_INDICATORS.find((i) => i.code === "C02")?.title).toBe("การจัดอาหารเสริม (นม)");
  });
  it("supabase/seed.sql is in sync with src/data/indicators.ts (run npm run seed:generate)", () => {
    expect(readFileSync("supabase/seed.sql", "utf8")).toBe(buildSeedSql());
  });
});
