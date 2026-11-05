"use client";
import { ErrorBox } from "@/components/ui/misc";
import type { ApiError } from "@/lib/client/api";

/** Shows an actionable message instead of fake data when the backend is not configured or unreachable. */
export function LoadError({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  if (error.code === "NOT_CONFIGURED") {
    const missing = (error.data.missing as string[] | undefined) ?? [];
    return (
      <div className="glass rounded-2xl p-6">
        <p className="font-semibold">ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล</p>
        <p className="mt-1 text-sm text-muted">
          ผู้ดูแลต้องตั้งค่า Environment Variables บนเซิร์ฟเวอร์ก่อน: {missing.join(", ") || "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"} —
          ดูคู่มือ docs/SUPABASE_SETUP.md และ docs/DEPLOYMENT.md
        </p>
      </div>
    );
  }
  return <ErrorBox message={error.message} onRetry={onRetry} />;
}
