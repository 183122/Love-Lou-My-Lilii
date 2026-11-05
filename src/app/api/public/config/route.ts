import { isTestMode } from "@/lib/server/backends";
import { env } from "@/lib/server/env";
import { json, route } from "@/lib/server/http";
import { loadSettings } from "@/lib/server/settings";
import { CHUNK_SIZE } from "@/lib/shared/files";

/** Public, non-sensitive configuration for the UI. */
export const GET = route(async () => {
  const s = await loadSettings();
  return json({
    schoolName: s.schoolName,
    schoolArea: s.schoolArea,
    systemName: s.systemName,
    systemNameEn: s.systemNameEn,
    semester: s.semester,
    academicYear: s.academicYear,
    limits: {
      maxImageBytes: Math.round(s.maxImageMb * 1024 * 1024),
      maxVideoBytes: Math.round(s.maxVideoMb * 1024 * 1024),
      maxFiles: s.maxFiles,
      allowedMime: s.allowedTypes,
    },
    chunkSize: CHUNK_SIZE,
    publicDashboard: s.publicDashboard,
    turnstileSiteKey: s.requireTurnstile && !isTestMode() ? env.turnstileSiteKey || null : null,
    testMode: isTestMode(),
  });
});
