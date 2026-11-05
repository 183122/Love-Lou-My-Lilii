export type MediaType = "IMAGE" | "VIDEO";
export type FileStatus = "PENDING" | "UPLOADING" | "UPLOADED" | "FAILED" | "MISSING" | "DELETED";
export type SubmissionStatus = "UPLOADING" | "COMPLETED" | "PARTIAL" | "FAILED";
export type IndicatorStatus = "NOT_SUBMITTED" | "PARTIAL" | "COMPLETED";
export type SessionRole = "ADMIN" | "VIEWER";

export interface Category {
  id: string;
  code: string;
  name: string;
  name_en: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface Indicator {
  id: string;
  code: string;
  category_id: string;
  title: string;
  description: string;
  recommended_evidence: string;
  required_image_count: number;
  required_video_count: number;
  sort_order: number;
  is_active: boolean;
}

export interface Submission {
  id: string;
  indicator_id: string;
  submitter_name: string;
  submitter_position: string;
  activity_title: string;
  activity_detail: string;
  activity_date: string;
  note: string;
  status: SubmissionStatus;
  client_ip_hash: string | null;
  created_at: string;
}

export interface EvidenceFile {
  id: string;
  submission_id: string;
  indicator_id: string;
  client_upload_id: string;
  file_name: string;
  mime_type: string;
  media_type: MediaType;
  size_bytes: number;
  status: FileStatus;
  bytes_uploaded: number;
  drive_upload_session_url: string | null;
  drive_upload_session_at: string | null;
  drive_file_id: string | null;
  drive_folder_id: string | null;
  drive_md5: string | null;
  error_message: string | null;
  is_vtr_selected: boolean;
  vtr_order: number | null;
  vtr_note: string;
  uploaded_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

/** EvidenceFile as safe to send to browsers (no Drive session URL). */
export type PublicEvidenceFile = Omit<EvidenceFile, "drive_upload_session_url" | "drive_upload_session_at">;

export interface DriveFolder {
  id: string;
  kind: "ROOT" | "CATEGORY" | "INDICATOR";
  root_folder_id: string;
  category_id: string | null;
  indicator_id: string | null;
  drive_folder_id: string;
  name: string;
}

export interface IndicatorCounts {
  indicator_id: string;
  image_count: number;
  video_count: number;
  vtr_selected_count: number;
  last_uploaded_at: string | null;
}

export interface IndicatorProgress {
  id: string;
  code: string;
  title: string;
  category_id: string;
  category_code: string;
  category_name: string;
  required_image_count: number;
  required_video_count: number;
  image_count: number;
  video_count: number;
  vtr_selected_count: number;
  last_uploaded_at: string | null;
  status: IndicatorStatus;
}

export interface DashboardData {
  generated_at: string;
  totals: {
    indicators: number;
    submitted: number;
    completed: number;
    partial: number;
    not_submitted: number;
    percent: number;
    images: number;
    videos: number;
    vtr_selected: number;
  };
  categories: Array<{
    id: string;
    code: string;
    name: string;
    color: string;
    total: number;
    completed: number;
    partial: number;
    percent: number;
  }>;
  indicators: IndicatorProgress[];
  recent: Array<{ code: string; title: string; last_uploaded_at: string; status: IndicatorStatus }>;
}

export interface EvidenceItem {
  id: string;
  file_name: string;
  mime_type: string;
  media_type: MediaType;
  size_bytes: number;
  status: EvidenceFile["status"];
  uploaded_at: string | null;
  created_at: string;
  is_vtr_selected: boolean;
  vtr_order: number | null;
  vtr_note: string;
  has_drive_file: boolean;
  indicator: { id: string; code: string; title: string };
  category: { id: string; code: string; name: string };
  submission: {
    id: string;
    activity_title: string;
    activity_detail: string;
    activity_date: string;
    submitter_name: string;
    submitter_position: string;
    note: string;
    created_at: string;
  };
}
