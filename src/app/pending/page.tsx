import { IndicatorBoard } from "@/components/dashboard/indicator-board";

export default function PendingPage() {
  return (
    <IndicatorBoard
      title="ยังไม่ส่ง"
      description="ตัวชี้วัดที่ยังไม่มีไฟล์ที่อัปโหลดสำเร็จ และที่ยังส่งไม่ครบเกณฑ์ขั้นต่ำ"
      statuses={["NOT_SUBMITTED", "PARTIAL"]}
      emptyTitle="ส่งหลักฐานครบทุกตัวชี้วัดแล้ว"
    />
  );
}
