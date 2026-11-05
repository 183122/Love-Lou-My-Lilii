import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="glass mx-auto mt-10 max-w-md rounded-2xl p-8 text-center">
      <p className="text-5xl font-bold brand-text">404</p>
      <p className="mt-2 text-muted">ไม่พบหน้าที่ต้องการ</p>
      <Button asChild className="mt-6">
        <Link href="/">กลับหน้า Dashboard</Link>
      </Button>
    </div>
  );
}
