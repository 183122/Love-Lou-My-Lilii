"use client";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/form";
import { Badge, Skeleton, Switch } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { useFetch } from "@/lib/client/use-fetch";
import type { Category, Indicator } from "@/lib/shared/types";

type IndicatorDraft = Omit<Indicator, "id"> & { id?: string };
type CategoryDraft = Omit<Category, "id"> & { id?: string };

export function IndicatorsTab() {
  const { data, loading, refresh } = useFetch<{ categories: Category[]; indicators: Indicator[] }>("/api/indicators?all=1");
  const [editInd, setEditInd] = useState<IndicatorDraft | null>(null);
  const [editCat, setEditCat] = useState<CategoryDraft | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !data) return <Skeleton className="h-96" />;

  const saveIndicator = async () => {
    if (!editInd) return;
    setBusy(true);
    try {
      const { id, ...body } = editInd;
      if (id) await api(`/api/admin/indicators/${id}`, { method: "PATCH", json: body });
      else await api("/api/admin/indicators", { method: "POST", json: body });
      toast.success("บันทึกตัวชี้วัดแล้ว");
      setEditInd(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveCategory = async () => {
    if (!editCat) return;
    setBusy(true);
    try {
      const { id, ...body } = editCat;
      if (id) await api(`/api/admin/categories/${id}`, { method: "PATCH", json: body });
      else await api("/api/admin/categories", { method: "POST", json: body });
      toast.success("บันทึกหมวดแล้ว");
      setEditCat(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (i: Indicator) => {
    try {
      await api(`/api/admin/indicators/${i.id}`, { method: "PATCH", json: { is_active: !i.is_active } });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (i: Indicator) => {
    if (!confirm(`ลบตัวชี้วัด ${i.code}? (ลบได้เฉพาะตัวชี้วัดที่ยังไม่มีหลักฐาน)`)) return;
    try {
      await api(`/api/admin/indicators/${i.id}`, { method: "DELETE" });
      toast.success("ลบแล้ว");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const move = async (cat: Category, idx: number, dir: -1 | 1) => {
    const list = data.indicators.filter((i) => i.category_id === cat.id);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    try {
      await api("/api/admin/indicators/reorder", { method: "POST", json: { ids: list.map((i) => i.id) } });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            setEditInd({
              code: "",
              category_id: data.categories[0]?.id ?? "",
              title: "",
              description: "",
              recommended_evidence: "",
              required_image_count: 3,
              required_video_count: 0,
              sort_order: 999,
              is_active: true,
            })
          }
        >
          <Plus /> เพิ่มตัวชี้วัด
        </Button>
        <Button
          variant="secondary"
          onClick={() => setEditCat({ code: "", name: "", name_en: "", color: "#38bdf8", sort_order: data.categories.length + 1, is_active: true })}
        >
          <Plus /> เพิ่มหมวด
        </Button>
        <Badge className="self-center">ตัวชี้วัดที่เปิดใช้งาน {data.indicators.filter((i) => i.is_active).length} รายการ</Badge>
      </div>

      {data.categories.map((cat) => {
        const list = data.indicators.filter((i) => i.category_id === cat.id);
        return (
          <Card key={cat.id}>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ background: cat.color }} />
                {cat.code}. {cat.name} {!cat.is_active && <Badge className="bg-slate-200 text-slate-600">ปิดใช้งาน</Badge>}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setEditCat({ ...cat })}>
                <Pencil /> แก้ไขหมวด
              </Button>
            </CardHeader>
            <CardContent className="grid gap-1.5">
              {list.map((i, idx) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/60 p-2 dark:bg-slate-800/40 sm:flex-nowrap" data-testid="admin-indicator-row">
                  <span className="w-12 text-sm font-semibold text-violet-600 dark:text-violet-300">{i.code}</span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${i.is_active ? "" : "text-muted line-through"}`}>{i.title}</span>
                  <span className="text-xs text-muted">ภาพ {i.required_image_count} · วิดีโอ {i.required_video_count}</span>
                  <Switch checked={i.is_active} onCheckedChange={() => toggleActive(i)} aria-label={`เปิดใช้งาน ${i.code}`} />
                  <Button size="icon" variant="ghost" onClick={() => move(cat, idx, -1)} disabled={idx === 0} aria-label="เลื่อนขึ้น">
                    <ArrowUp />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => move(cat, idx, 1)} disabled={idx === list.length - 1} aria-label="เลื่อนลง">
                    <ArrowDown />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditInd({ ...i })} aria-label={`แก้ไข ${i.code}`}>
                    <Pencil />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(i)} aria-label={`ลบ ${i.code}`}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={editInd !== null} onOpenChange={(o) => !o && setEditInd(null)}>
        {editInd && (
          <DialogContent title={editInd.id ? `แก้ไขตัวชี้วัด ${editInd.code}` : "เพิ่มตัวชี้วัด"}>
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="ind-code">รหัส</Label>
                  <Input id="ind-code" value={editInd.code} onChange={(e) => setEditInd({ ...editInd, code: e.target.value.toUpperCase() })} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="ind-cat">หมวด</Label>
                  <NativeSelect id="ind-cat" value={editInd.category_id} onChange={(e) => setEditInd({ ...editInd, category_id: e.target.value })}>
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}. {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div>
                <Label htmlFor="ind-title">ชื่อตัวชี้วัด</Label>
                <Input id="ind-title" value={editInd.title} onChange={(e) => setEditInd({ ...editInd, title: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ind-desc">คำอธิบาย</Label>
                <Textarea id="ind-desc" className="min-h-16" value={editInd.description} onChange={(e) => setEditInd({ ...editInd, description: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ind-ev">หลักฐานที่แนะนำ</Label>
                <Textarea id="ind-ev" className="min-h-16" value={editInd.recommended_evidence} onChange={(e) => setEditInd({ ...editInd, recommended_evidence: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="ind-img">รูปภาพขั้นต่ำ</Label>
                  <Input id="ind-img" type="number" min={0} max={100} value={editInd.required_image_count} onChange={(e) => setEditInd({ ...editInd, required_image_count: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="ind-vid">วิดีโอขั้นต่ำ</Label>
                  <Input id="ind-vid" type="number" min={0} max={100} value={editInd.required_video_count} onChange={(e) => setEditInd({ ...editInd, required_video_count: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="ind-sort">ลำดับ</Label>
                  <Input id="ind-sort" type="number" min={0} value={editInd.sort_order} onChange={(e) => setEditInd({ ...editInd, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setEditInd(null)}>
                  ยกเลิก
                </Button>
                <Button onClick={saveIndicator} disabled={busy}>
                  บันทึก
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={editCat !== null} onOpenChange={(o) => !o && setEditCat(null)}>
        {editCat && (
          <DialogContent title={editCat.id ? `แก้ไขหมวด ${editCat.code}` : "เพิ่มหมวด"}>
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="cat-code">รหัส</Label>
                  <Input id="cat-code" value={editCat.code} onChange={(e) => setEditCat({ ...editCat, code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label htmlFor="cat-color">สี</Label>
                  <Input id="cat-color" type="color" value={editCat.color} onChange={(e) => setEditCat({ ...editCat, color: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="cat-sort">ลำดับ</Label>
                  <Input id="cat-sort" type="number" min={0} value={editCat.sort_order} onChange={(e) => setEditCat({ ...editCat, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label htmlFor="cat-name">ชื่อหมวด</Label>
                <Input id="cat-name" value={editCat.name} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cat-name-en">ชื่อภาษาอังกฤษ</Label>
                <Input id="cat-name-en" value={editCat.name_en} onChange={(e) => setEditCat({ ...editCat, name_en: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editCat.is_active} onCheckedChange={(c) => setEditCat({ ...editCat, is_active: c })} /> เปิดใช้งาน
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setEditCat(null)}>
                  ยกเลิก
                </Button>
                <Button onClick={saveCategory} disabled={busy}>
                  บันทึก
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
