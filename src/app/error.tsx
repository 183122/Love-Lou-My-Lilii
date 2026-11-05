"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="glass mx-auto mt-10 max-w-md rounded-2xl p-8 text-center">
      <p className="text-lg font-semibold">เกิดข้อผิดพลาด</p>
      <p className="mt-2 text-sm text-muted">{error.message || "กรุณาลองใหม่อีกครั้ง"}</p>
      <Button className="mt-6" onClick={reset}>
        ลองใหม่
      </Button>
    </div>
  );
}
