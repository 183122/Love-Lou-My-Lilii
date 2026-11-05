import { describe, expect, it } from "vitest";
import { computeIndicatorStatus } from "@/lib/shared/status";

// Test 30: indicator status calculation
describe("computeIndicatorStatus", () => {
  const base = { requiredImages: 3, requiredVideos: 1 };
  it("NOT_SUBMITTED when no uploaded files", () => {
    expect(computeIndicatorStatus({ ...base, imageCount: 0, videoCount: 0 })).toBe("NOT_SUBMITTED");
  });
  it("PARTIAL when some files but images below minimum", () => {
    expect(computeIndicatorStatus({ ...base, imageCount: 2, videoCount: 1 })).toBe("PARTIAL");
  });
  it("PARTIAL when images met but video missing", () => {
    expect(computeIndicatorStatus({ ...base, imageCount: 10, videoCount: 0 })).toBe("PARTIAL");
  });
  it("COMPLETED when both minimums met", () => {
    expect(computeIndicatorStatus({ ...base, imageCount: 3, videoCount: 1 })).toBe("COMPLETED");
  });
  it("COMPLETED with zero video requirement once images are met", () => {
    expect(computeIndicatorStatus({ requiredImages: 2, requiredVideos: 0, imageCount: 2, videoCount: 0 })).toBe("COMPLETED");
  });
  it("requires at least one file even when minimums are zero", () => {
    expect(computeIndicatorStatus({ requiredImages: 0, requiredVideos: 0, imageCount: 0, videoCount: 0 })).toBe("NOT_SUBMITTED");
    expect(computeIndicatorStatus({ requiredImages: 0, requiredVideos: 0, imageCount: 1, videoCount: 0 })).toBe("COMPLETED");
  });
  it("ignores negative/garbage counts", () => {
    expect(computeIndicatorStatus({ ...base, imageCount: -5, videoCount: -1 })).toBe("NOT_SUBMITTED");
  });
});
