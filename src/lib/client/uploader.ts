"use client";

export class UploadError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public code = "ERROR",
  ) {
    super(message);
  }
}

interface Target {
  id: string;
  uploadToken: string;
}

const MAX_NETWORK_RETRIES = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readBody(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/** Ask the server how many bytes Google Drive has already committed (resume point). */
export async function queryCommitted(target: Target): Promise<{ committed: number; done: boolean }> {
  const res = await fetch(`/api/uploads/${target.id}`, {
    headers: { "x-upload-token": target.uploadToken },
    cache: "no-store",
  });
  const body = await readBody(res);
  if (!res.ok) throw new UploadError(String(body.error ?? "ตรวจสอบสถานะไม่สำเร็จ"), res.status >= 500 || res.status === 429, String(body.code));
  return { committed: Number(body.committed ?? 0), done: body.status === "UPLOADED" };
}

/**
 * Upload a file in chunks through the server proxy to Google Drive.
 * - Resumes from the committed offset after network drops (exponential backoff)
 * - Never reports success unless the server confirms status UPLOADED
 */
export async function uploadFile(
  file: Blob,
  target: Target,
  chunkSize: number,
  onProgress: (sent: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const total = file.size;
  let offset = 0;
  let netFailures = 0;

  // Resume: if a previous attempt got partway, continue from Drive's committed offset.
  try {
    const s = await queryCommitted(target);
    if (s.done) {
      onProgress(total, total);
      return;
    }
    offset = s.committed;
  } catch (e) {
    if (e instanceof UploadError && !e.retryable) throw e;
  }

  while (true) {
    if (signal?.aborted) throw new UploadError("ยกเลิกการอัปโหลด", true, "ABORTED");
    onProgress(offset, total);
    const end = Math.min(offset + chunkSize, total);
    const chunk = file.slice(offset, end);
    let res: Response;
    try {
      res = await fetch(`/api/uploads/${target.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Range": `bytes ${offset}-${end - 1}/${total}`,
          "x-upload-token": target.uploadToken,
        },
        body: chunk,
        signal,
      });
    } catch {
      if (signal?.aborted) throw new UploadError("ยกเลิกการอัปโหลด", true, "ABORTED");
      // Network dropped: back off, then re-sync the committed offset with the server.
      if (++netFailures > MAX_NETWORK_RETRIES)
        throw new UploadError("การเชื่อมต่อขาดหายระหว่างอัปโหลด กด “ลองใหม่” เพื่ออัปโหลดต่อจากจุดเดิม", true, "NETWORK");
      await sleep(Math.min(16000, 1000 * 2 ** (netFailures - 1)));
      try {
        offset = (await queryCommitted(target)).committed;
      } catch {
        /* keep offset; next PUT will resync via 409 */
      }
      continue;
    }

    const body = await readBody(res);
    if (res.ok) {
      netFailures = 0;
      if (body.status === "UPLOADED") {
        onProgress(total, total);
        return;
      }
      offset = Number(body.committed ?? end);
      continue;
    }
    if (res.status === 409 && typeof body.committed === "number") {
      offset = body.committed;
      continue;
    }
    // Auto-retry only transient failures. Permission/token problems (502 DRIVE_*) need a human, so surface them at once.
    const transient = res.status === 429 || res.status === 503 || res.status === 500 || res.status === 504;
    if (transient && ++netFailures <= MAX_NETWORK_RETRIES) {
      await sleep(Math.min(16000, 1000 * 2 ** (netFailures - 1)));
      try {
        offset = (await queryCommitted(target)).committed;
      } catch {
        /* ignore */
      }
      continue;
    }
    throw new UploadError(String(body.error ?? `อัปโหลดไม่สำเร็จ (${res.status})`), res.status >= 500 || res.status === 429, String(body.code ?? ""));
  }
}

export function newClientUploadId(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
