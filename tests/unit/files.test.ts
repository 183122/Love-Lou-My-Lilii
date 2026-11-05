import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE,
  checkFileMeta,
  DEFAULT_ALLOWED_MIME,
  DEFAULT_LIMITS,
  formatBytes,
  sanitizeFileName,
  sniffMatches,
  sniffMime,
} from "@/lib/shared/files";
import { fakeJpeg, fakeMp4, fakePng } from "../helpers/harness";

const limits = { ...DEFAULT_LIMITS, allowedMime: DEFAULT_ALLOWED_MIME };
const MB = 1024 * 1024;

// Test 8: file size validation
describe("file size validation", () => {
  it("accepts an image at exactly 20 MB", () => {
    expect(checkFileMeta({ name: "a.jpg", size: 20 * MB, type: "image/jpeg" }, limits).ok).toBe(true);
  });
  it("rejects an image over 20 MB", () => {
    const r = checkFileMeta({ name: "a.jpg", size: 20 * MB + 1, type: "image/jpeg" }, limits);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("เกินกำหนด");
  });
  it("accepts a 500 MB video and rejects 501 MB", () => {
    expect(checkFileMeta({ name: "v.mp4", size: 500 * MB, type: "video/mp4" }, limits).ok).toBe(true);
    expect(checkFileMeta({ name: "v.mp4", size: 501 * MB, type: "video/mp4" }, limits).ok).toBe(false);
  });
  it("rejects empty files", () => {
    expect(checkFileMeta({ name: "a.png", size: 0, type: "image/png" }, limits).ok).toBe(false);
  });
});

// Test 9: file type validation
describe("file type validation", () => {
  it.each([
    ["a.jpg", "image/jpeg"],
    ["a.JPEG", "image/jpeg"],
    ["a.png", "image/png"],
    ["a.webp", "image/webp"],
    ["a.mp4", "video/mp4"],
    ["a.MOV", "video/quicktime"],
    ["a.webm", "video/webm"],
  ])("accepts %s", (name, type) => {
    expect(checkFileMeta({ name, size: 10, type }, limits)).toMatchObject({ ok: true, mime: type });
  });
  it("infers MIME from extension when browser type is empty (mobile .mov)", () => {
    expect(checkFileMeta({ name: "clip.mov", size: 10, type: "" }, limits)).toMatchObject({ ok: true, mime: "video/quicktime", mediaType: "VIDEO" });
  });
  it.each(["a.exe", "a.gif", "a.heic", "a.svg", "a.html", "noext"])("rejects %s", (name) => {
    expect(checkFileMeta({ name, size: 10, type: "" }, limits).ok).toBe(false);
  });
  it("rejects extension/type mismatch (image named .mp4)", () => {
    expect(checkFileMeta({ name: "x.mp4", size: 10, type: "image/png" }, limits).ok).toBe(false);
  });
  it("respects admin-restricted allowed types", () => {
    expect(checkFileMeta({ name: "x.webm", size: 10, type: "video/webm" }, { ...limits, allowedMime: ["image/jpeg"] }).ok).toBe(false);
  });
});

describe("magic-byte sniffing (real content type)", () => {
  it("detects jpeg/png/mp4", () => {
    expect(sniffMime(fakeJpeg(16))).toBe("image/jpeg");
    expect(sniffMime(fakePng(16))).toBe("image/png");
    expect(sniffMime(fakeMp4(16))).toBe("video/mp4");
  });
  it("detects webp, webm, quicktime", () => {
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffMime(webp)).toBe("image/webp");
    expect(sniffMime(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).toBe("video/webm");
    const mov = new Uint8Array(16);
    mov.set(new TextEncoder().encode("\0\0\0\x14ftypqt  "));
    expect(sniffMime(mov)).toBe("video/quicktime");
  });
  it("rejects disguised executables / html", () => {
    expect(sniffMime(new TextEncoder().encode("MZ\x90\0\x03\0\0\0"))).toBeNull();
    expect(sniffMime(new TextEncoder().encode("<html><script>"))).toBeNull();
  });
  it("treats mp4 and mov containers as compatible", () => {
    expect(sniffMatches("video/quicktime", "video/mp4")).toBe(true);
    expect(sniffMatches("image/png", "image/jpeg")).toBe(false);
    expect(sniffMatches("image/png", null)).toBe(false);
  });
});

describe("misc", () => {
  it("chunk size is a multiple of 256 KiB and below Vercel's 4.5 MB body limit", () => {
    expect(CHUNK_SIZE % (256 * 1024)).toBe(0);
    expect(CHUNK_SIZE).toBeLessThan(4.5 * 1000 * 1000);
  });
  it("sanitizes file names", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName('C:\\x\\a<b>:"c".jpg')).toBe("a_b___c_.jpg");
    expect(sanitizeFileName("ภาพกิจกรรม 1.jpg")).toBe("ภาพกิจกรรม 1.jpg");
  });
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(20 * MB)).toBe("20.0 MB");
  });
});
