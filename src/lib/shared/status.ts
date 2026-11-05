import type { IndicatorStatus } from "./types";

/**
 * Indicator status is derived ONLY from successfully uploaded files
 * (status = UPLOADED) — never from the number of submissions.
 *
 * COMPLETED: image and video minimums are met (and at least one file exists)
 * PARTIAL:   at least one uploaded file but minimums not met
 * NOT_SUBMITTED: no uploaded files
 */
export function computeIndicatorStatus(input: {
  imageCount: number;
  videoCount: number;
  requiredImages: number;
  requiredVideos: number;
}): IndicatorStatus {
  const images = Math.max(0, input.imageCount | 0);
  const videos = Math.max(0, input.videoCount | 0);
  if (images + videos === 0) return "NOT_SUBMITTED";
  if (images >= input.requiredImages && videos >= input.requiredVideos) return "COMPLETED";
  return "PARTIAL";
}

export const STATUS_LABEL: Record<IndicatorStatus, string> = {
  NOT_SUBMITTED: "ยังไม่ส่ง",
  PARTIAL: "ส่งบางส่วน",
  COMPLETED: "ส่งครบแล้ว",
};
