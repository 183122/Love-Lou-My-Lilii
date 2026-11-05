import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_PASSWORD, cookieJar, ctx, fakeJpeg, fakeMp4, fakePng, req, setup } from "../helpers/harness";
import type { MemoryRepo } from "@/lib/server/db/memory-repo";
import type { FakeDrive } from "@/lib/server/drive/fake-drive";
import { CHUNK_SIZE } from "@/lib/shared/files";
import type { DashboardData } from "@/lib/shared/types";

import * as dashboardRoute from "@/app/api/dashboard/route";
import * as indicatorsRoute from "@/app/api/indicators/route";
import * as submissionsRoute from "@/app/api/submissions/route";
import * as uploadRoute from "@/app/api/uploads/[fileId]/route";
import * as filesRoute from "@/app/api/files/route";
import * as contentRoute from "@/app/api/files/[id]/content/route";
import * as loginRoute from "@/app/api/auth/login/route";
import * as adminFileRoute from "@/app/api/admin/files/[id]/route";
import * as adminIndicatorRoute from "@/app/api/admin/indicators/[id]/route";
import * as adminSettingsRoute from "@/app/api/admin/settings/route";
import * as manifestRoute from "@/app/api/admin/vtr/manifest/route";
import * as verifyRoute from "@/app/api/admin/files/verify/route";
import * as foldersRoute from "@/app/api/admin/drive/folders/route";
import * as driveStatusRoute from "@/app/api/admin/drive/status/route";

let repo: MemoryRepo;
let drive: FakeDrive;

beforeEach(async () => {
  ({ repo, drive } = await setup());
});

const indicatorByCode = (code: string) => repo.indicators.find((i) => i.code === code)!;
let uid = 0;
const cid = () => `client-${Date.now()}-${++uid}`.padEnd(12, "x");

async function createSubmission(code: string, files: Array<{ name: string; size: number; type: string }>) {
  const res = await submissionsRoute.POST(
    req("/api/submissions", {
      method: "POST",
      json: {
        indicatorId: indicatorByCode(code).id,
        submitterName: "ครูสมใจ ใจดี",
        submitterPosition: "ครู",
        activityTitle: "ประชุมครูก่อนเปิดภาคเรียน",
        activityDetail: "รายละเอียด",
        activityDate: "2026-10-30",
        note: "",
        files: files.map((f) => ({ ...f, clientUploadId: cid() })),
      },
    }),
  );
  return { res, body: (await res.json()) as { submissionId: string; files: { id: string; uploadToken: string; clientUploadId: string }[]; error?: string; code?: string } };
}

async function putChunk(fileId: string, token: string, data: Uint8Array, start: number, total: number) {
  const res = await uploadRoute.PUT(
    req(`/api/uploads/${fileId}`, {
      method: "PUT",
      headers: { "content-range": `bytes ${start}-${start + data.byteLength - 1}/${total}`, "x-upload-token": token },
      body: data as unknown as BodyInit,
    }),
    ctx({ fileId }),
  );
  return { res, body: (await res.json()) as { status?: string; committed?: number; code?: string; error?: string } };
}

/** Upload a whole buffer in CHUNK_SIZE pieces, like the browser does. */
async function uploadAll(fileId: string, token: string, data: Uint8Array) {
  let offset = 0;
  let last;
  while (offset < data.byteLength) {
    const end = Math.min(offset + CHUNK_SIZE, data.byteLength);
    last = await putChunk(fileId, token, data.subarray(offset, end), offset, data.byteLength);
    if (!last.res.ok) return last;
    offset = last.body.committed!;
  }
  return last!;
}

async function dashboard() {
  return (await (await dashboardRoute.GET()).json()) as DashboardData;
}

async function loginAdmin() {
  const res = await loginRoute.POST(req("/api/auth/login", { method: "POST", json: { password: ADMIN_PASSWORD } }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { csrfToken: string }).csrfToken;
}

describe("public dashboard & indicators", () => {
  // Test 1 & 2
  it("loads dashboard from the database with 36 indicators, all NOT_SUBMITTED initially", async () => {
    const d = await dashboard();
    expect(d.totals.indicators).toBe(36);
    expect(d.totals.not_submitted).toBe(36);
    expect(d.totals.percent).toBe(0);
    expect(d.categories).toHaveLength(7);
    // no sensitive data (submitter names) in public dashboard payload
    expect(JSON.stringify(d)).not.toContain("submitter");
  });
  it("lists active categories and indicators", async () => {
    const body = (await (await indicatorsRoute.GET(req("/api/indicators"))).json()) as { categories: unknown[]; indicators: unknown[] };
    expect(body.categories).toHaveLength(7);
    expect(body.indicators).toHaveLength(36);
  });
});

describe("submission + upload to Drive", () => {
  // Tests 5, 6, 7, 10, 11, 12, 13
  it("uploads an image and a multi-chunk video, creates folders, records Drive file IDs and updates dashboard", async () => {
    const img = fakeJpeg(50_000);
    const vid = fakeMp4(CHUNK_SIZE * 2 + 12345); // 3 chunks
    const { res, body } = await createSubmission("A01", [
      { name: "ภาพประชุม.jpg", size: img.byteLength, type: "image/jpeg" },
      { name: "clip.mp4", size: vid.byteLength, type: "video/mp4" },
    ]);
    expect(res.status).toBe(201);
    expect(body.files).toHaveLength(2);
    // no Drive session URL / credential returned to the browser
    expect(JSON.stringify(body)).not.toMatch(/googleapis|upload_id|refresh/i);

    const r1 = await uploadAll(body.files[0].id, body.files[0].uploadToken, img);
    expect(r1.body.status).toBe("UPLOADED");
    const r2 = await uploadAll(body.files[1].id, body.files[1].uploadToken, vid);
    expect(r2.body.status).toBe("UPLOADED");
    expect(drive.calls.uploadChunk).toBe(4);

    // Test 12: real Drive file id recorded, in the indicator folder
    const f = (await repo.getFile(body.files[1].id))!;
    expect(f.status).toBe("UPLOADED");
    expect(f.drive_file_id).toMatch(/^file_/);
    const node = drive.nodes.get(f.drive_file_id!)!;
    expect(node.data!.byteLength).toBe(vid.byteLength);
    const folder = drive.nodes.get(node.parentId!)!;
    expect(folder.name).toBe("A01 ประชุมครูก่อนเปิดภาคเรียน");
    expect(drive.nodes.get(folder.parentId!)!.name).toBe("A. การบริหารงานทั่วไป");
    expect(f.drive_upload_session_url).toBeNull();

    // Test 11: second submission to same indicator reuses folders (no duplicates)
    const before = drive.calls.createFolder;
    const { body: b2 } = await createSubmission("A01", [{ name: "b.png", size: 2000, type: "image/png" }]);
    await uploadAll(b2.files[0].id, b2.files[0].uploadToken, fakePng(2000));
    expect(drive.calls.createFolder).toBe(before);

    // Test 13: dashboard updated from real counts
    const d = await dashboard();
    const a01 = d.indicators.find((i) => i.code === "A01")!;
    expect(a01).toMatchObject({ image_count: 2, video_count: 1, status: "PARTIAL" }); // needs 3 images
    expect(d.totals.images).toBe(2);
    expect(d.totals.videos).toBe(1);
    expect(d.recent[0].code).toBe("A01");
  });

  it("marks indicator COMPLETED only when minimum images and videos are uploaded", async () => {
    // D01 requires 1 image, 0 video
    const { body } = await createSubmission("D01", [{ name: "order.jpg", size: 500, type: "image/jpeg" }]);
    expect((await dashboard()).indicators.find((i) => i.code === "D01")!.status).toBe("NOT_SUBMITTED"); // registered but not uploaded
    await uploadAll(body.files[0].id, body.files[0].uploadToken, fakeJpeg(500));
    expect((await dashboard()).indicators.find((i) => i.code === "D01")!.status).toBe("COMPLETED");
  });

  it("validates required form fields", async () => {
    const res = await submissionsRoute.POST(
      req("/api/submissions", { method: "POST", json: { indicatorId: indicatorByCode("A01").id, submitterName: "", files: [] } }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/กรุณา/);
  });

  // Test 8 (server-side)
  it("rejects oversize files on the server", async () => {
    const { res, body } = await createSubmission("A01", [{ name: "big.jpg", size: 21 * 1024 * 1024, type: "image/jpeg" }]);
    expect(res.status).toBe(400);
    expect(body.error).toContain("เกินกำหนด");
  });

  it("rejects more than the maximum number of files", async () => {
    const files = Array.from({ length: 21 }, (_, i) => ({ name: `${i}.jpg`, size: 10, type: "image/jpeg" }));
    const { res } = await createSubmission("A01", files);
    expect(res.status).toBe(400);
  });

  // Test 9 (server-side content sniffing)
  it("rejects a file whose content is not really an image and never marks it uploaded", async () => {
    const { body } = await createSubmission("A02", [{ name: "evil.jpg", size: 100, type: "image/jpeg" }]);
    const fake = new TextEncoder().encode("<html><script>alert(1)</script>".padEnd(100, " "));
    const r = await putChunk(body.files[0].id, body.files[0].uploadToken, fake, 0, 100);
    expect(r.res.status).toBe(415);
    expect((await repo.getFile(body.files[0].id))!.status).toBe("FAILED");
    expect(drive.calls.initResumable).toBe(0);
  });

  it("rejects chunks with a forged or wrong upload token", async () => {
    const { body } = await createSubmission("A01", [{ name: "a.jpg", size: 100, type: "image/jpeg" }]);
    const other = await createSubmission("A01", [{ name: "b.jpg", size: 100, type: "image/jpeg" }]);
    const r = await putChunk(body.files[0].id, other.body.files[0].uploadToken, fakeJpeg(100), 0, 100);
    expect(r.res.status).toBe(401);
  });

  // Test 25: duplicate submission
  it("is idempotent when the same files are submitted twice (no duplicate records)", async () => {
    const payload = {
      indicatorId: indicatorByCode("B06").id,
      submitterName: "ครู ข",
      submitterPosition: "ครู",
      activityTitle: "Active Learning",
      activityDate: "2026-10-30",
      files: [{ clientUploadId: "dup-client-0001", name: "a.jpg", size: 100, type: "image/jpeg" }],
    };
    const r1 = await submissionsRoute.POST(req("/api/submissions", { method: "POST", json: payload }));
    const r2 = await submissionsRoute.POST(req("/api/submissions", { method: "POST", json: payload }));
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    const b1 = (await r1.json()) as { submissionId: string };
    const b2 = (await r2.json()) as { submissionId: string; reused: boolean };
    expect(b2.reused).toBe(true);
    expect(b2.submissionId).toBe(b1.submissionId);
    expect(repo.submissions).toHaveLength(1);
    expect(repo.files).toHaveLength(1);
  });

  it("re-sending an already uploaded chunk does not create a second Drive file", async () => {
    const { body } = await createSubmission("A01", [{ name: "a.jpg", size: 100, type: "image/jpeg" }]);
    await putChunk(body.files[0].id, body.files[0].uploadToken, fakeJpeg(100), 0, 100);
    const again = await putChunk(body.files[0].id, body.files[0].uploadToken, fakeJpeg(100), 0, 100);
    expect(again.body.status).toBe("UPLOADED");
    expect([...drive.nodes.values()].filter((n) => n.name === "a.jpg")).toHaveLength(1);
  });
});

describe("failure handling", () => {
  // Test 23 + 27: Drive has no write permission
  it("fails the submission early with a helpful message when Drive has no write permission", async () => {
    drive.failures.forbidden = true;
    const { res, body } = await createSubmission("A03", [{ name: "a.jpg", size: 100, type: "image/jpeg" }]);
    expect(res.status).toBe(502);
    expect(body.code).toBe("DRIVE_FORBIDDEN");
    expect(body.error).toContain("ไม่มีสิทธิ์เขียน");
    expect(repo.files).toHaveLength(0);
  });

  it("marks a file FAILED (not UPLOADED) when Drive permission is lost mid-upload", async () => {
    const { body } = await createSubmission("A03", [{ name: "a.jpg", size: 100, type: "image/jpeg" }]);
    drive.failures.forbidden = true;
    const r = await putChunk(body.files[0].id, body.files[0].uploadToken, fakeJpeg(100), 0, 100);
    expect(r.res.ok).toBe(false);
    const f = (await repo.getFile(body.files[0].id))!;
    expect(f.status).toBe("FAILED");
    expect(f.drive_file_id).toBeNull();
    expect((await dashboard()).indicators.find((i) => i.code === "A03")!.status).toBe("NOT_SUBMITTED");
  });

  // Test 26: token expired/revoked
  it("reports an expired/revoked Google token with a reconnect hint", async () => {
    drive.failures.tokenRevoked = true;
    const { body } = await createSubmission("A01", [{ name: "a.jpg", size: 100, type: "image/jpeg" }]);
    expect(body.code).toBe("DRIVE_TOKEN_REVOKED");
    expect(body.error).toContain("เชื่อมต่อใหม่");
  });

  // Tests 24 + 29: network drop mid-upload, then retry resumes from committed offset
  it("resumes after a network drop without re-sending committed bytes", async () => {
    const vid = fakeMp4(CHUNK_SIZE * 3);
    const { body } = await createSubmission("B10", [{ name: "v.mp4", size: vid.byteLength, type: "video/mp4" }]);
    const [f] = body.files;
    const c1 = await putChunk(f.id, f.uploadToken, vid.subarray(0, CHUNK_SIZE), 0, vid.byteLength);
    expect(c1.body.committed).toBe(CHUNK_SIZE);

    drive.failures.networkDropChunks = 1;
    const c2 = await putChunk(f.id, f.uploadToken, vid.subarray(CHUNK_SIZE, CHUNK_SIZE * 2), CHUNK_SIZE, vid.byteLength);
    expect(c2.res.status).toBe(503);
    expect((await repo.getFile(f.id))!.status).toBe("FAILED");

    // client asks where to resume
    const st = await uploadRoute.GET(req(`/api/uploads/${f.id}`, { headers: { "x-upload-token": f.uploadToken } }), ctx({ fileId: f.id }));
    expect(((await st.json()) as { committed: number }).committed).toBe(CHUNK_SIZE);

    // wrong offset is corrected by server (409 + committed)
    const wrong = await putChunk(f.id, f.uploadToken, vid.subarray(0, CHUNK_SIZE), 0, vid.byteLength);
    expect(wrong.res.status).toBe(409);
    expect(wrong.body.committed).toBe(CHUNK_SIZE);

    let offset = CHUNK_SIZE;
    let last;
    while (offset < vid.byteLength) {
      last = await putChunk(f.id, f.uploadToken, vid.subarray(offset, offset + CHUNK_SIZE), offset, vid.byteLength);
      offset = last.body.committed!;
    }
    expect(last!.body.status).toBe("UPLOADED");
    expect(drive.calls.initResumable).toBe(1); // same Drive session reused
    expect((await repo.getFile(f.id))!.status).toBe("UPLOADED");
    expect(repo.submissions[0].status).toBe("COMPLETED");
  });

  it("restarts cleanly when the Drive resumable session expired", async () => {
    const vid = fakeMp4(CHUNK_SIZE * 2);
    const { body } = await createSubmission("B10", [{ name: "v.mp4", size: vid.byteLength, type: "video/mp4" }]);
    const [f] = body.files;
    await putChunk(f.id, f.uploadToken, vid.subarray(0, CHUNK_SIZE), 0, vid.byteLength);
    drive.failures.expireSessions = 1;
    const r = await putChunk(f.id, f.uploadToken, vid.subarray(CHUNK_SIZE), CHUNK_SIZE, vid.byteLength);
    expect(r.res.status).toBe(409);
    expect(r.body).toMatchObject({ code: "SESSION_EXPIRED", committed: 0 });
    const done = await uploadAll(f.id, f.uploadToken, vid);
    expect(done.body.status).toBe("UPLOADED");
    expect(drive.calls.initResumable).toBe(2);
  });
});

describe("authorization", () => {
  // Test 21
  it("protects evidence and admin endpoints", async () => {
    expect((await filesRoute.GET(req("/api/files"))).status).toBe(401);
    expect((await adminSettingsRoute.GET(req("/api/admin/settings"))).status).toBe(401);
    const bad = await loginRoute.POST(req("/api/auth/login", { method: "POST", json: { password: "wrong" } }));
    expect(bad.status).toBe(401);
  });

  it("requires a CSRF token and same origin for admin mutations", async () => {
    const csrf = await loginAdmin();
    const id = indicatorByCode("A01").id;
    const noCsrf = await adminIndicatorRoute.PATCH(req(`/api/admin/indicators/${id}`, { method: "PATCH", json: { title: "x" } }), ctx({ id }));
    expect(noCsrf.status).toBe(403);
    const crossSite = new Request(`http://localhost:3000/api/admin/indicators/${id}`, {
      method: "PATCH",
      headers: { host: "localhost:3000", origin: "https://evil.example", "x-csrf-token": csrf, "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    expect((await adminIndicatorRoute.PATCH(crossSite, ctx({ id }))).status).toBe(403);
  });

  it("rate-limits admin password guessing", async () => {
    const statuses = [];
    for (let i = 0; i < 7; i++)
      statuses.push((await loginRoute.POST(req("/api/auth/login", { method: "POST", json: { password: "nope" } }))).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("stores only a hash of the session token", async () => {
    await loginAdmin();
    const cookie = [...cookieJar.values()][0];
    expect(repo.sessions[0].token_hash).not.toBe(cookie);
    expect(repo.sessions[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("admin features", () => {
  // Test 20
  it("edits an indicator's minimum requirement and status is recalculated", async () => {
    const csrf = await loginAdmin();
    const { body } = await createSubmission("D02", [{ name: "pa.jpg", size: 100, type: "image/jpeg" }]);
    await uploadAll(body.files[0].id, body.files[0].uploadToken, fakeJpeg(100));
    expect((await dashboard()).indicators.find((i) => i.code === "D02")!.status).toBe("PARTIAL"); // needs 2
    const id = indicatorByCode("D02").id;
    const res = await adminIndicatorRoute.PATCH(
      req(`/api/admin/indicators/${id}`, { method: "PATCH", csrf, json: { required_image_count: 1, title: "การจัดทำข้อตกลง PA (แก้ไข)" } }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    const row = (await dashboard()).indicators.find((i) => i.code === "D02")!;
    expect(row.status).toBe("COMPLETED");
    expect(row.title).toBe("การจัดทำข้อตกลง PA (แก้ไข)");
    // deactivated indicators are excluded from the dashboard
    await adminIndicatorRoute.PATCH(req(`/api/admin/indicators/${id}`, { method: "PATCH", csrf, json: { is_active: false } }), ctx({ id }));
    expect((await dashboard()).totals.indicators).toBe(35);
  });

  // Tests 14–18
  it("lists gallery, streams image, supports Range for video, download headers, VTR selection and manifest", async () => {
    const csrf = await loginAdmin();
    const img = fakeJpeg(3000);
    const vid = fakeMp4(5000);
    const { body } = await createSubmission("B06", [
      { name: "ห้องเรียน.jpg", size: img.byteLength, type: "image/jpeg" },
      { name: "สอน.mp4", size: vid.byteLength, type: "video/mp4" },
    ]);
    await uploadAll(body.files[0].id, body.files[0].uploadToken, img);
    await uploadAll(body.files[1].id, body.files[1].uploadToken, vid);

    const list = (await (await filesRoute.GET(req(`/api/files?indicator=${indicatorByCode("B06").id}`))).json()) as { items: { id: string; media_type: string; submission: { submitter_name: string } }[] };
    expect(list.items).toHaveLength(2);
    expect(list.items[0].submission.submitter_name).toBe("ครูสมใจ ใจดี");

    const imgId = body.files[0].id;
    const r = await contentRoute.GET(req(`/api/files/${imgId}/content`), ctx({ id: imgId }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await r.arrayBuffer()).byteLength).toBe(3000);

    const vidId = body.files[1].id;
    const ranged = await contentRoute.GET(req(`/api/files/${vidId}/content`, { headers: { range: "bytes=0-99" } }), ctx({ id: vidId }));
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("content-range")).toBe("bytes 0-99/5000");

    const dl = await contentRoute.GET(req(`/api/files/${vidId}/content?download=1`), ctx({ id: vidId }));
    expect(dl.headers.get("content-disposition")).toBe(`attachment; filename*=UTF-8''${encodeURIComponent("สอน.mp4")}`);

    for (const id of [vidId, imgId]) {
      const s = await adminFileRoute.PATCH(req(`/api/admin/files/${id}`, { method: "PATCH", csrf, json: { is_vtr_selected: true } }), ctx({ id }));
      expect(s.status).toBe(200);
    }
    await adminFileRoute.PATCH(req(`/api/admin/files/${vidId}`, { method: "PATCH", csrf, json: { vtr_note: "ใช้ช่วง 0:10-0:20" } }), ctx({ id: vidId }));
    const csv = await (await manifestRoute.GET(req("/api/admin/vtr/manifest"))).text();
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^1,B\. การบริหารงานวิชาการ,B06 .*,สอน\.mp4,วิดีโอ,ใช้ช่วง 0:10-0:20$/);
    expect(lines[2]).toMatch(/^2,.*ห้องเรียน\.jpg,รูปภาพ,$/);
    expect((await dashboard()).totals.vtr_selected).toBe(2);
  });

  // Test 28
  it("detects files deleted from Drive and recalculates indicator status", async () => {
    const csrf = await loginAdmin();
    const { body } = await createSubmission("D01", [{ name: "order.jpg", size: 100, type: "image/jpeg" }]);
    await uploadAll(body.files[0].id, body.files[0].uploadToken, fakeJpeg(100));
    expect((await dashboard()).indicators.find((i) => i.code === "D01")!.status).toBe("COMPLETED");

    drive.removeExternally((await repo.getFile(body.files[0].id))!.drive_file_id!);
    // viewing it returns 410 and marks it MISSING
    const r = await contentRoute.GET(req(`/api/files/${body.files[0].id}/content`), ctx({ id: body.files[0].id }));
    expect(r.status).toBe(410);
    expect((await repo.getFile(body.files[0].id))!.status).toBe("MISSING");
    expect((await dashboard()).indicators.find((i) => i.code === "D01")!.status).toBe("NOT_SUBMITTED");

    const v = await verifyRoute.POST(req("/api/admin/files/verify", { method: "POST", csrf }));
    expect(((await v.json()) as { missing: number }).missing).toBe(1);
  });

  it("deletes evidence (database only vs. also trash in Drive) and recalculates status", async () => {
    const csrf = await loginAdmin();
    const { body } = await createSubmission("D01", [
      { name: "a.jpg", size: 100, type: "image/jpeg" },
      { name: "b.jpg", size: 100, type: "image/jpeg" },
    ]);
    for (const f of body.files) await uploadAll(f.id, f.uploadToken, fakeJpeg(100));
    const [a, b] = await Promise.all(body.files.map((f) => repo.getFile(f.id)));

    const noConfirm = await adminFileRoute.DELETE(req(`/api/admin/files/${a!.id}`, { method: "DELETE", csrf, json: { mode: "drive" } }), ctx({ id: a!.id }));
    expect(noConfirm.status).toBe(400);

    await adminFileRoute.DELETE(req(`/api/admin/files/${a!.id}`, { method: "DELETE", csrf, json: { mode: "database", confirm: true } }), ctx({ id: a!.id }));
    expect(drive.nodes.get(a!.drive_file_id!)!.trashed).toBe(false);
    await adminFileRoute.DELETE(req(`/api/admin/files/${b!.id}`, { method: "DELETE", csrf, json: { mode: "drive", confirm: true } }), ctx({ id: b!.id }));
    expect(drive.nodes.get(b!.drive_file_id!)!.trashed).toBe(true);
    expect(repo.files).toHaveLength(0);
    expect((await dashboard()).indicators.find((i) => i.code === "D01")!.status).toBe("NOT_SUBMITTED");
  });

  it("creates the full folder tree idempotently and reports real Drive status", async () => {
    const csrf = await loginAdmin();
    const r1 = (await (await foldersRoute.POST(req("/api/admin/drive/folders", { method: "POST", csrf }))).json()) as { mapped: number };
    expect(r1.mapped).toBe(7 + 36);
    const created = drive.calls.createFolder;
    expect(created).toBe(1 + 7 + 36);
    await foldersRoute.POST(req("/api/admin/drive/folders", { method: "POST", csrf }));
    expect(drive.calls.createFolder).toBe(created);
    const st = (await (await driveStatusRoute.GET(req("/api/admin/drive/status"))).json()) as { connected: boolean; rootWritable: boolean; foldersMapped: number };
    expect(st).toMatchObject({ connected: true, rootWritable: true, foldersMapped: 43 });
  });

  it("validates settings updates", async () => {
    const csrf = await loginAdmin();
    const bad = await adminSettingsRoute.PUT(req("/api/admin/settings", { method: "PUT", csrf, json: { academicYear: "abc" } }));
    expect(bad.status).toBe(400);
    const ok = await adminSettingsRoute.PUT(req("/api/admin/settings", { method: "PUT", csrf, json: { maxFiles: 5, academicYear: "2570" } }));
    expect(ok.status).toBe(200);
    const { res } = await createSubmission("A01", Array.from({ length: 6 }, (_, i) => ({ name: `${i}.jpg`, size: 10, type: "image/jpeg" })));
    expect(res.status).toBe(400);
  });
});
