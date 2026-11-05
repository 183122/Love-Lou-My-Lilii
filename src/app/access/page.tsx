"use client";
import Link from "next/link";
import { LoginCard } from "@/components/auth/access-gate";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";

export default function AccessPage() {
  const { role } = useApp();
  return (
    <>
      <PageHeader title="เข้าสู่ระบบ" description="ผู้ส่งหลักฐานไม่ต้องเข้าสู่ระบบ — หน้านี้สำหรับผู้ดูแลและผู้ชมที่ได้รับรหัส" />
      {role ? (
        <Card className="mx-auto max-w-md p-6 text-center">
          <p>คุณเข้าสู่ระบบแล้วในฐานะ {role === "ADMIN" ? "ผู้ดูแลระบบ" : "ผู้ชม"}</p>
          <Button asChild className="mt-4">
            <Link href="/gallery">ไปที่คลังหลักฐาน</Link>
          </Button>
        </Card>
      ) : (
        <LoginCard need="VIEWER" />
      )}
    </>
  );
}
