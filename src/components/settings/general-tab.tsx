"use client";
import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/form";
import { Switch } from "@/components/ui/misc";
import { formatBytes } from "@/lib/shared/files";
import type { AdminSettings } from "./use-settings";

type Props = { settings: AdminSettings; save: (p: Partial<AdminSettings>) => Promise<boolean>; saving: boolean };

export function GeneralTab({ settings, save, saving }: Props) {
  const [v, setV] = useState(settings);
  return (
    <Card>
      <CardHeader>
        <CardTitle>ข้อมูลโรงเรียนและระบบ</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="schoolName">ชื่อโรงเรียน</Label>
          <Input id="schoolName" value={v.schoolName} onChange={(e) => setV({ ...v, schoolName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="schoolArea">สังกัด</Label>
          <Input id="schoolArea" value={v.schoolArea} onChange={(e) => setV({ ...v, schoolArea: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="systemName">ชื่อระบบ (ภาษาไทย)</Label>
          <Input id="systemName" value={v.systemName} onChange={(e) => setV({ ...v, systemName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="systemNameEn">ชื่อระบบ (ภาษาอังกฤษ)</Label>
          <Input id="systemNameEn" value={v.systemNameEn} onChange={(e) => setV({ ...v, systemNameEn: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="semester">ภาคเรียน</Label>
          <NativeSelect id="semester" value={v.semester} onChange={(e) => setV({ ...v, semester: e.target.value })}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3 (ฤดูร้อน)</option>
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="academicYear">ปีการศึกษา (พ.ศ.)</Label>
          <Input id="academicYear" inputMode="numeric" value={v.academicYear} onChange={(e) => setV({ ...v, academicYear: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Button
            disabled={saving}
            onClick={() =>
              save({
                schoolName: v.schoolName,
                schoolArea: v.schoolArea,
                systemName: v.systemName,
                systemNameEn: v.systemNameEn,
                semester: v.semester,
                academicYear: v.academicYear,
              })
            }
          >
            <Save /> บันทึก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const TYPES = [
  ["image/jpeg", "JPG / JPEG"],
  ["image/png", "PNG"],
  ["image/webp", "WEBP"],
  ["video/mp4", "MP4"],
  ["video/quicktime", "MOV"],
  ["video/webm", "WEBM"],
] as const;

export function UploadTab({ settings, save, saving }: Props) {
  const [v, setV] = useState(settings);
  return (
    <Card>
      <CardHeader>
        <CardTitle>ขนาดและประเภทไฟล์</CardTitle>
        <p className="text-sm text-muted">ระบบตรวจสอบทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์ รวมถึงตรวจเนื้อหาไฟล์จริง (magic bytes)</p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="maxImageMb">รูปภาพสูงสุด (MB/ไฟล์)</Label>
          <Input id="maxImageMb" type="number" min={1} max={100} value={v.maxImageMb} onChange={(e) => setV({ ...v, maxImageMb: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="maxVideoMb">วิดีโอสูงสุด (MB/ไฟล์)</Label>
          <Input id="maxVideoMb" type="number" min={1} max={5000} value={v.maxVideoMb} onChange={(e) => setV({ ...v, maxVideoMb: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="maxFiles">จำนวนไฟล์สูงสุดต่อการส่ง</Label>
          <Input id="maxFiles" type="number" min={1} max={50} value={v.maxFiles} onChange={(e) => setV({ ...v, maxFiles: Number(e.target.value) })} />
        </div>
        <fieldset className="sm:col-span-3">
          <legend className="mb-2 text-sm font-medium">ประเภทไฟล์ที่อนุญาต</legend>
          <div className="flex flex-wrap gap-3">
            {TYPES.map(([mime, label]) => (
              <label key={mime} className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
                <input
                  type="checkbox"
                  checked={v.allowedTypes.includes(mime)}
                  onChange={(e) =>
                    setV({ ...v, allowedTypes: e.target.checked ? [...v.allowedTypes, mime] : v.allowedTypes.filter((t) => t !== mime) })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-muted sm:col-span-3">
          ไฟล์ใหญ่จะถูกแบ่งส่งเป็นชิ้นละ {formatBytes(3932160)} ผ่านเซิร์ฟเวอร์ไปยัง Google Drive (Resumable Upload) จึงไม่ติดขีดจำกัด 4.5 MB ต่อคำขอของ Vercel
        </p>
        <div className="sm:col-span-3">
          <Button disabled={saving} onClick={() => save({ maxImageMb: v.maxImageMb, maxVideoMb: v.maxVideoMb, maxFiles: v.maxFiles, allowedTypes: v.allowedTypes })}>
            <Save /> บันทึก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DisplayTab({ settings, save, saving }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>การแสดงผล</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ToggleRow
          label="เปิด Dashboard สาธารณะ"
          description="ผู้ส่งหลักฐานดูความคืบหน้าได้โดยไม่ต้องเข้าสู่ระบบ (แสดงเฉพาะสถิติ ไม่แสดงชื่อผู้ส่งหรือไฟล์)"
          checked={settings.publicDashboard}
          disabled={saving}
          onChange={(c) => save({ publicDashboard: c })}
        />
        <p className="text-xs text-muted">ธีมสว่าง/มืด เปลี่ยนได้จากปุ่มบนแถบด้านบน (จดจำตามอุปกรณ์)</p>
      </CardContent>
    </Card>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-white/60 p-3 dark:bg-slate-800/40">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
