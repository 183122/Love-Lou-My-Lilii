import "server-only";

/** Centralised, typed access to server environment variables. Never import from client code. */
export const env = {
  get supabaseUrl() {
    return process.env.SUPABASE_URL ?? "";
  },
  get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get googleClientId() {
    return process.env.GOOGLE_CLIENT_ID ?? "";
  },
  get googleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET ?? "";
  },
  /** Optional fallback. Preferred: connect via the admin UI, which stores the token AES-256-GCM encrypted in the DB. */
  get googleRefreshToken() {
    return process.env.GOOGLE_REFRESH_TOKEN ?? "";
  },
  get googleDriveRootFolderId() {
    return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "";
  },
  /** drive.file (default, least privilege) or drive (needed only for a pre-existing root folder created outside the app). */
  get googleDriveScope() {
    return process.env.GOOGLE_DRIVE_SCOPE === "drive"
      ? "https://www.googleapis.com/auth/drive"
      : "https://www.googleapis.com/auth/drive.file";
  },
  get adminPasswordHash() {
    return process.env.ADMIN_PASSWORD_HASH ?? "";
  },
  get viewerAccessCodeHash() {
    return process.env.VIEWER_ACCESS_CODE_HASH ?? "";
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET ?? "";
  },
  /** Key for encrypting the Google refresh token at rest. Falls back to a key derived from SESSION_SECRET. */
  get tokenEncryptionKey() {
    return process.env.TOKEN_ENCRYPTION_KEY ?? "";
  },
  get appUrl() {
    // Read via a computed key so the bundler does not inline the build-time value:
    // on Cloudflare the runtime var/secret must win.
    const key = "NEXT_PUBLIC_APP_URL";
    return (process.env[key] ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get turnstileSiteKey() {
    return process.env.TURNSTILE_SITE_KEY ?? "";
  },
  get turnstileSecretKey() {
    return process.env.TURNSTILE_SECRET_KEY ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

export function missingCoreEnv(): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("SUPABASE_URL");
  if (!env.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.sessionSecret || env.sessionSecret.length < 32) missing.push("SESSION_SECRET (อย่างน้อย 32 ตัวอักษร)");
  if (!env.adminPasswordHash) missing.push("ADMIN_PASSWORD_HASH");
  return missing;
}
