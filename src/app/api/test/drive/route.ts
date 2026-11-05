import { getFakeDrive, getRepo, isTestMode } from "@/lib/server/backends";
import { json } from "@/lib/server/http";

/** TEST MODE ONLY: failure injection for the E2E suite. 404 in every other mode. */
export async function POST(req: Request) {
  if (!isTestMode()) return new Response("Not found", { status: 404 });
  const body = (await req.json()) as Partial<ReturnType<typeof getFakeDrive>["failures"]> & { removeEvidenceId?: string };
  const drive = getFakeDrive();
  const { removeEvidenceId, ...failures } = body;
  Object.assign(drive.failures, failures);
  if (removeEvidenceId) {
    const f = await getRepo().getFile(removeEvidenceId);
    if (f?.drive_file_id) drive.removeExternally(f.drive_file_id);
  }
  return json({ failures: drive.failures });
}
