"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Crown, Loader2 } from "lucide-react";
import { platformService } from "@/services/platformService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckboxInput, NumberInput, TextInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const STATE_LABEL = { trial: "Free trial", active: "Active", grace: "Grace period", unpaid: "Unpaid — workspace locked" };
const KIND_LABEL = { trial: "Trial", paid: "Paid", granted: "Granted" };
const unlimited = (n) => (n === null || n === undefined ? "∞" : n);

/* Calendar dates as local "YYYY-MM-DD"; day maths in UTC so DST never shifts a day. */
const pad = (n) => String(n).padStart(2, "0");
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => localDate(new Date());
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diffDays = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const prettyDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** One shop's plan on the platform shop page — current plan, usage, history, and granting / extending / shortening a plan. */
export function ShopSubscriptionCard({ shopId }) {
  const qc = useQueryClient();
  const [granting, setGranting] = useState(false);
  const [form, setForm] = useState({ plan_id: "", ends_at: "", days: "", note: "", trial: false });
  const [errors, setErrors] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["platform-shop-subscription", shopId],
    queryFn: () => platformService.subscriptions.shop(shopId).then((r) => r.data.data),
  });
  const { data: plans } = useQuery({
    queryKey: ["platform-subscription-plans"],
    queryFn: () => platformService.subscriptions.plans().then((r) => r.data.data),
    enabled: granting,
  });

  const current = data?.current;
  const running = current && ["trial", "active"].includes(current.state);
  const currentEnd = running && current.ends_at ? localDate(new Date(current.ends_at)) : null;

  const openDialog = () => {
    setErrors({});
    if (running && current.plan.id) {
      // Start from the current plan and end date — move the date to extend or shorten it.
      setForm({ plan_id: String(current.plan.id), ends_at: currentEnd, days: String(diffDays(todayStr(), currentEnd)), note: "", trial: false });
    } else {
      const end = addDays(todayStr(), 30);
      setForm({ plan_id: "", ends_at: end, days: "30", note: "", trial: false });
    }
    setGranting(true);
  };

  // End date and Days stay in step: days = from today to the end date.
  const setEndDate = (v) => setForm((f) => ({ ...f, ends_at: v, days: v ? String(diffDays(todayStr(), v)) : "" }));
  const setDays = (v) => setForm((f) => ({ ...f, days: v, ends_at: v !== "" && Number(v) >= 0 ? addDays(todayStr(), Number(v)) : f.ends_at }));

  const grant = useMutation({
    mutationFn: () => platformService.subscriptions.grant(shopId, { plan_id: Number(form.plan_id), ends_at: form.ends_at, note: form.note || undefined, trial: !samePlan && form.trial }),
    onSuccess: (res) => {
      qc.setQueryData(["platform-shop-subscription", shopId], res.data.data);
      qc.invalidateQueries({ queryKey: ["platform-subscription-stats"] });
      toast.success(res.data.message ?? "Plan updated");
      setGranting(false);
      setErrors({});
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (!err.response?.data?.errors) toast.error(err.response?.data?.message ?? "Could not update the plan");
    },
  });

  const planOptions = (plans?.plans ?? []).map((p) => ({ value: String(p.id), label: p.name }));
  const pickedPlan = (plans?.plans ?? []).find((p) => String(p.id) === form.plan_id);
  const samePlan = running && form.plan_id === String(current.plan.id);
  const delta = samePlan && form.ends_at ? diffDays(currentEnd, form.ends_at) : null;
  const pastDate = form.ends_at && form.ends_at < todayStr();

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> Subscription</span>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={openDialog} disabled={!current}>
            {running ? "Change plan / dates" : "Grant plan"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading || !current ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div>
              <p className="font-semibold">{current.plan.name} <span className="font-normal text-muted-foreground">· {STATE_LABEL[current.state]}</span></p>
              {current.ends_at && <p className="text-xs text-muted-foreground">{current.state === "grace" ? `Ended ${formatDateTime(current.ends_at)} · grace until ${formatDateTime(current.grace_ends_at)}` : `Until ${formatDateTime(current.ends_at)} (${current.days_left} days)`}</p>}
            </div>
            {current.state !== "unpaid" && (
              <p className="text-xs text-muted-foreground">
                Vehicles {current.usage.vehicles}/{unlimited(current.plan.max_vehicles)} · For sale {current.usage.sale_listings}/{unlimited(current.plan.max_sale_listings)} · Staff {current.usage.staff}/{unlimited(current.plan.max_staff)} · Locations {current.usage.locations}/{unlimited(current.plan.max_locations)}
              </p>
            )}
            {data.history?.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                {data.history.slice(0, 5).map((h) => (
                  <p key={h.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{h.plan}</span> · {KIND_LABEL[h.kind] ?? h.kind} · {formatDateTime(h.starts_at)} → {formatDateTime(h.ends_at)}{h.by ? ` · ${h.by}` : ""}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={granting} onOpenChange={setGranting}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{running ? "Change plan or dates" : "Grant a plan"}</DialogTitle>
            <DialogDescription>
              Keep the same plan and move the end date to extend or shorten it. Pick another plan to switch — it starts today, either as a grant or as a free trial.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); grant.mutate(); }}>
            <SelectInput label="Plan" required options={planOptions} value={form.plan_id} onChange={(v) => setForm((f) => ({ ...f, plan_id: v }))} error={errors.plan_id?.[0]} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Ends on" type="date" min={todayStr()} value={form.ends_at} onChange={(e) => setEndDate(e.target.value)} error={errors.ends_at?.[0]} />
              <NumberInput label="Days from today" min="0" value={form.days} onChange={(e) => setDays(e.target.value)} />
            </div>

            {/* What will happen */}
            {form.plan_id && form.ends_at && !pastDate && (
              <div className={cn(
                "rounded-xl border px-3 py-2.5 text-sm",
                delta > 0 && "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                delta < 0 && "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
                (delta === null || delta === 0) && "bg-muted/40",
              )}>
                {samePlan ? (
                  <>
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      {prettyDate(currentEnd)} <ArrowRight className="h-3.5 w-3.5" /> {prettyDate(form.ends_at)}
                      <span className="ml-auto tabular-nums">{delta > 0 ? `+${delta}` : delta} day{Math.abs(delta) === 1 ? "" : "s"}</span>
                    </p>
                    <p className="mt-0.5 text-xs opacity-80">
                      {delta > 0 && (current.state === "trial" ? "The trial is extended — it stays a free trial." : `${current.plan.name} is extended.`)}
                      {delta < 0 && `${current.plan.name} ends sooner.${current.state === "trial" ? " The shop is locked when the trial ends." : " A grace period follows before the shop is locked."}`}
                      {delta === 0 && "No change to the end date."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">{form.trial ? "Free trial of " : ""}{pickedPlan?.name ?? "Plan"} from today to {prettyDate(form.ends_at)} · {Number(form.days) === 0 ? "ends tonight" : `${form.days} day${Number(form.days) === 1 ? "" : "s"}`}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {running ? `The current ${current.plan.name} ${current.state === "trial" ? "trial" : "plan"} ends today — no refund or carry-over.` : current?.state === "unpaid" ? "The shop's workspace opens straight away." : "Replaces the plan in grace."}
                      {form.trial ? " Shown as a free trial; the shop is locked when it ends (no grace)." : " A grace period follows when it ends."}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Only when the plan starts today — changing the running plan's dates keeps its type. */}
            {form.plan_id && !samePlan && (
              <CheckboxInput id="grant-as-trial" className="pt-0" label="Give as free trial (trial label, no grace when it ends)" checked={form.trial} onChange={(on) => setForm((f) => ({ ...f, trial: !!on }))} />
            )}

            <TextInput label="Note (optional)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Trial extension, launch offer" error={errors.note?.[0]} />
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setGranting(false)}>Cancel</Button>
              <Button type="submit" disabled={grant.isPending || !form.plan_id || !form.ends_at || pastDate || delta === 0}>
                {grant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {samePlan ? (delta < 0 ? "Shorten" : "Extend") : form.trial ? "Start trial" : "Grant"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
