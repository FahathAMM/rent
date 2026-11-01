"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CarFront, Check, Crown, Loader2, MapPin, Minus, Pencil, Plus, Users } from "lucide-react";
import { platformService } from "@/services/platformService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckboxInput, NumberInput, TextInput, TextareaInput } from "@/components/forms/FormField";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPTY = { code: "", name: "", description: "", price: "0", period_days: "30", max_vehicles: "", max_staff: "", max_locations: "", features: [], is_active: true, sort_order: "0" };
// Header band per plan — known codes get their own colour, others cycle.
const ACCENTS = {
  basic: { band: "bg-gradient-to-br from-slate-500/10 to-transparent", icon: "text-slate-500" },
  pro: { band: "bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-transparent", icon: "text-indigo-600" },
  business: { band: "bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent", icon: "text-amber-600" },
};
const ACCENTS_BY_INDEX = [
  { band: "bg-gradient-to-br from-emerald-500/15 to-transparent", icon: "text-emerald-600" },
  { band: "bg-gradient-to-br from-sky-500/15 to-transparent", icon: "text-sky-600" },
  { band: "bg-gradient-to-br from-pink-500/15 to-transparent", icon: "text-pink-600" },
];

/** Plans shops can choose. Only the Platform Owner can add or edit (canEdit). Free is always the fallback plan. */
export function PlansTab({ canEdit }) {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [editing, setEditing] = useState(null); // plan object, or {} for new
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["platform-subscription-plans"],
    queryFn: () => platformService.subscriptions.plans().then((r) => r.data.data),
  });

  const open = (plan) => {
    setErrors({});
    setEditing(plan ?? {});
    setForm(plan ? {
      ...EMPTY, ...plan,
      price: String(plan.price), period_days: String(plan.period_days), sort_order: String(plan.sort_order ?? 0),
      max_vehicles: plan.max_vehicles ?? "", max_staff: plan.max_staff ?? "", max_locations: plan.max_locations ?? "",
      description: plan.description ?? "",
    } : EMPTY);
  };

  const save = useMutation({
    mutationFn: () => {
      const n = (v) => (v === "" || v === null ? null : Number(v));
      const payload = {
        ...form, price: Number(form.price), period_days: Number(form.period_days), sort_order: Number(form.sort_order || 0),
        max_vehicles: n(form.max_vehicles), max_staff: n(form.max_staff), max_locations: n(form.max_locations),
      };
      return editing?.id ? platformService.subscriptions.updatePlan(editing.id, payload) : platformService.subscriptions.createPlan(payload);
    },
    onSuccess: (res) => {
      toast.success(res.data.message ?? "Plan saved");
      qc.invalidateQueries({ queryKey: ["platform-subscription-plans"] });
      setEditing(null);
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (!err.response?.data?.errors) toast.error(err.response?.data?.message ?? "Could not save the plan");
    },
  });

  if (isLoading || !data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggleFeature = (key, on) => setForm({ ...form, features: on ? [...form.features, key] : form.features.filter((k) => k !== key) });

  return (
    <div className="space-y-4">
      {!canEdit && <p className="text-sm text-muted-foreground">Only the Platform Owner can add or change plans.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.plans.map((plan, i) => {
          const accent = ACCENTS[plan.code] ?? ACCENTS_BY_INDEX[i % ACCENTS_BY_INDEX.length];
          return (
            <Card key={plan.id} className={cn("flex flex-col overflow-hidden rounded-2xl shadow-sm", !plan.is_active && "opacity-60")}>
              <div className={cn("relative px-5 pb-4 pt-5", accent.band)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-base font-semibold">
                      <Crown className={cn("h-4 w-4", accent.icon)} /> {plan.name}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{plan.code}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", plan.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                    {plan.is_active ? "Live" : "Hidden"}
                  </span>
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">
                  {plan.price > 0 ? format(plan.price) : "Free"}
                  {plan.price > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">/ {plan.period_days === 30 ? "month" : `${plan.period_days} days`}</span>}
                </p>
                {plan.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>}
              </div>

              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div className="grid grid-cols-3 gap-2">
                  {[[CarFront, "Vehicles", plan.max_vehicles], [Users, "Staff", plan.max_staff], [MapPin, "Locations", plan.max_locations]].map(([Icon, label, n]) => (
                    <div key={label} className="rounded-xl border bg-muted/30 px-2 py-2.5 text-center">
                      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
                      <p className="mt-1 text-lg font-semibold leading-none tabular-nums">{n === null || n === undefined ? "∞" : n}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                <ul className="space-y-2 text-sm">
                  {Object.entries(data.features).map(([key, label]) => {
                    const on = plan.features.includes(key);
                    return (
                      <li key={key} className={cn("flex items-center gap-2", !on && "text-muted-foreground")}>
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", on ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground")}>
                          {on ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        </span>
                        <span className={cn(!on && "line-through")}>{label}</span>
                      </li>
                    );
                  })}
                </ul>

                {canEdit && (
                  <Button variant="outline" size="sm" className="mt-auto gap-1.5" onClick={() => open(plan)}><Pencil className="h-3.5 w-3.5" /> Edit plan</Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {canEdit && (
          <button type="button" onClick={() => open(null)} className="flex min-h-[18rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary">
            <Plus className="h-6 w-6" /> Add a plan
          </button>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? `Edit ${editing.name}` : "New plan"}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Name" required value={form.name} onChange={f("name")} error={errors.name?.[0]} />
              <TextInput label="Code" required value={form.code} onChange={f("code")} error={errors.code?.[0]} />
              <NumberInput label="Price (LKR per period)" value={form.price} onChange={f("price")} min="0" error={errors.price?.[0]} />
              <NumberInput label="Period (days)" value={form.period_days} onChange={f("period_days")} min="1" error={errors.period_days?.[0]} />
              <NumberInput label="Max vehicles (blank = unlimited)" value={form.max_vehicles} onChange={f("max_vehicles")} min="0" error={errors.max_vehicles?.[0]} />
              <NumberInput label="Max staff (blank = unlimited)" value={form.max_staff} onChange={f("max_staff")} min="0" error={errors.max_staff?.[0]} />
              <NumberInput label="Max locations (blank = unlimited)" value={form.max_locations} onChange={f("max_locations")} min="0" error={errors.max_locations?.[0]} />
              <NumberInput label="Order" value={form.sort_order} onChange={f("sort_order")} min="0" error={errors.sort_order?.[0]} />
            </div>
            <TextareaInput label="Description" rows={2} value={form.description} onChange={f("description")} error={errors.description?.[0]} />
            <div className="space-y-1.5 rounded-lg border p-3">
              <p className="text-sm font-medium">Features</p>
              {Object.entries(data.features).map(([key, label]) => (
                <CheckboxInput key={key} id={`feature-${key}`} className="pt-0" label={label} checked={form.features.includes(key)} onChange={(on) => toggleFeature(key, on)} />
              ))}
            </div>
            <CheckboxInput id="plan-active" className="pt-0" label="Shops can choose this plan" checked={!!form.is_active} onChange={(on) => setForm({ ...form, is_active: on })} />
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
