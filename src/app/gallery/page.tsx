"use client";
import { AccessGate } from "@/components/auth/access-gate";
import { EvidenceGallery } from "@/components/gallery/evidence-gallery";
import { PageHeader } from "@/components/ui/misc";

export default function GalleryPage() {
  return (
    <>
      <PageHeader title="คลังรูปภาพและวิดีโอ" description="หลักฐานที่อัปโหลดสำเร็จทั้งหมด — ไฟล์เปิดผ่านเซิร์ฟเวอร์ที่ตรวจสอบสิทธิ์ ไม่มีการเปิดสาธารณะใน Google Drive" />
      <AccessGate need="VIEWER">
        <EvidenceGallery />
      </AccessGate>
    </>
  );
}
