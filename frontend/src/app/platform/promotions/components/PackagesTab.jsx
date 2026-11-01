"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Pencil, Plus, Star } from "lucide-react";
import { platformService } from "@/services/platformService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckboxInput, NumberInput, TextInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KEY = ["platform-promotion-packages"];
const TYPES = {
  featured: { label: "Featured vehicle", hint: "One vehicle first in vehicle search (every sort, when it matches the filters) and on the home page.", Icon: Star, tone: "text-amber-600 bg-amber-500/15" },
  sponsored: { label: "Shop sponsorship", hint: "The shop first on the Shops page (every sort, and when filtered by its city).", Icon: Megaphone, tone: "text-indigo-600 bg-indigo-500/15" },
};
const EMPTY = { type: "featured", name: "", days: "7", price: "0", is_active: true, sort_order: "0" };

/** Packages shops can buy, and how many slots there are. Platform Owner edits (canEdit). */
export function PackagesTab({ canEdit }) {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [slots, setSlots] = useState(null);
  const [errors, setErrors] = useState({});

  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: () => platformService.promotions.packages().then((r) => r.data.data) });
  useEffect(() => {
    if (data) setSlots({ featured_listing_slots: String(data.settings.featured_listing_slots), sponsored_slots_per_target: String(data.settings.sponsored_slots_per_target) });
  }, [data]);

  const fail = (err) => {
    setErrors(err.response?.data?.errors ?? {});
    if (!err.response?.data?.errors) toast.error(err.response?.data?.message ?? "Could not save");
  };
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, days: Number(form.days), price: Number(form.price), sort_order: Number(form.sort_order || 0) };
      return editing?.id ? platformService.promotions.updatePackage(editing.id, payload) : platformService.promotions.createPackage(payload);
    },
    onSuccess: (r) => { toast.success(r.data.message ?? "Saved"); qc.invalidateQueries({ queryKey: KEY }); setEditing(null); },
    onError: fail,
  });
  const saveSlots = useMutation({
    mutationFn: () => platformService.promotions.updateSettings({ featured_listing_slots: Number(slots.featured_listing_slots), sponsored_slots_per_target: Number(slots.sponsored_slots_per_target) }),
    onSuccess: () => { toast.success("Slots saved"); setErrors({}); qc.invalidateQueries({ queryKey: KEY }); },
    onError: fail,
  });

  if (isLoading || !data || !slots) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const open = (pkg, type) => {
    setErrors({});
    setEditing(pkg ?? { type });
    setForm(pkg ? { ...EMPTY, ...pkg, days: String(pkg.days), price: String(pkg.price), sort_order: String(pkg.sort_order ?? 0) } : { ...EMPTY, type });
  };
  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {Object.entries(TYPES).map(([type, meta]) => {
          const list = data.packages.filter((p) => p.type === type);
          return (
            <Card key={type} className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", meta.tone)}><meta.Icon className="h-4 w-4" /></span>
                    {meta.label}
                  </span>
                  {canEdit && <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => open(null, type)}><Plus className="h-3.5 w-3.5" /> Package</Button>}
                </CardTitle>
                <CardDescription>{meta.hint}</CardDescription>
              </CardHeader>
              <CardContent>
                {!list.length ? <p className="text-sm text-muted-foreground">No packages.</p> : (
                  <div className="divide-y overflow-hidden rounded-xl border">
                    {list.map((p) => (
                      <div key={p.id} className={cn("flex items-center justify-between gap-3 px-4 py-3 text-sm", !p.is_active && "opacity-60")}>
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.days} days{p.is_active ? "" : " · hidden from shops"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold tabular-nums">{format(p.price)}</span>
                          {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => open(p)}><Pencil className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Slots</CardTitle>
          <CardDescription>Keeps promotions special. When all slots are taken, a newly approved promotion is scheduled for the first date one frees up.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <NumberInput className="w-56" label="Featured vehicles at once" min="1" value={slots.featured_listing_slots} onChange={(e) => setSlots({ ...slots, featured_listing_slots: e.target.value })} disabled={!canEdit} error={errors.featured_listing_slots?.[0]} />
          <NumberInput className="w-56" label="Sponsored shops per city" min="1" value={slots.sponsored_slots_per_target} onChange={(e) => setSlots({ ...slots, sponsored_slots_per_target: e.target.value })} disabled={!canEdit} error={errors.sponsored_slots_per_target?.[0]} />
          {canEdit ? (
            <Button onClick={() => saveSlots.mutate()} disabled={saveSlots.isPending}>{saveSlots.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save slots</Button>
          ) : <p className="text-sm text-muted-foreground">Only the Platform Owner can change packages and slots.</p>}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? `Edit ${editing.name}` : "New package"}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <SelectInput label="Type" options={[{ value: "featured", label: "Featured vehicle" }, { value: "sponsored", label: "Shop sponsorship" }]} value={form.type} onChange={(v) => setForm({ ...form, type: v })} error={errors.type?.[0]} />
            <TextInput label="Name" required value={form.name} onChange={f("name")} placeholder="e.g. Featured — 14 days" error={errors.name?.[0]} />
            <div className="grid grid-cols-3 gap-3">
              <NumberInput label="Days" min="1" value={form.days} onChange={f("days")} error={errors.days?.[0]} />
              <NumberInput label="Price (LKR)" min="0" value={form.price} onChange={f("price")} error={errors.price?.[0]} />
              <NumberInput label="Order" min="0" value={form.sort_order} onChange={f("sort_order")} error={errors.sort_order?.[0]} />
            </div>
            <CheckboxInput id="pkg-active" className="pt-0" label="Shops can buy this package" checked={!!form.is_active} onChange={(on) => setForm({ ...form, is_active: !!on })} />
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
