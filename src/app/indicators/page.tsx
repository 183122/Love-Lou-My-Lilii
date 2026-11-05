import { IndicatorBoard } from "@/components/dashboard/indicator-board";

export default function IndicatorsPage() {
  return (
    <IndicatorBoard
      title="ตัวชี้วัดทั้งหมด"
      description="คลิกที่ตัวชี้วัดเพื่อดูรายละเอียด หลักฐานที่แนะนำ และหลักฐานที่ส่งแล้ว"
      emptyTitle="ไม่พบตัวชี้วัด"
    />
  );
}
