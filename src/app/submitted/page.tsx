import { IndicatorBoard } from "@/components/dashboard/indicator-board";

export default function SubmittedPage() {
  return (
    <IndicatorBoard
      title="หลักฐานที่ส่งแล้ว"
      description="ตัวชี้วัดที่มีไฟล์อัปโหลดสำเร็จแล้ว (ส่งครบ และส่งบางส่วน)"
      statuses={["COMPLETED", "PARTIAL"]}
      emptyTitle="ยังไม่มีตัวชี้วัดที่ส่งหลักฐาน"
    />
  );
}
