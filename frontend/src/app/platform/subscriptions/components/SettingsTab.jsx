"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Eye, Landmark, Loader2 } from "lucide-react";
import { platformService } from "@/services/platformService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput, TextInput, TextareaInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { toast } from "sonner";

const EMPTY_BANK = { bank_name: "", branch: "", account_name: "", account_number: "", instructions: "" };

/** Trial, grace period and the platform bank account shops pay into. Platform Owner edits; others read. */
export function SettingsTab({ canEdit }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  const { data } = useQuery({
    queryKey: ["platform-subscription-settings"],
    queryFn: () => platformService.subscriptions.settings().then((r) => r.data.data),
  });
  const { data: plans } = useQuery({
    queryKey: ["platform-subscription-plans"],
    queryFn: () => platformService.subscriptions.plans().then((r) => r.data.data),
  });

  useEffect(() => {
    if (data) setForm({ trial_plan: data.trial_plan, trial_days: String(data.trial_days), grace_days: String(data.grace_days), bank: { ...EMPTY_BANK, ...(data.bank ?? {}) } });
  }, [data]);

  const save = useMutation({
    mutationFn: () => platformService.subscriptions.updateSettings({ ...form, trial_days: Number(form.trial_days), grace_days: Number(form.grace_days) }),
    onSuccess: () => { toast.success("Subscription settings saved"); setErrors({}); qc.invalidateQueries({ queryKey: ["platform-subscription-settings"] }); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (!err.response?.data?.errors) toast.error(err.response?.data?.message ?? "Could not save");
    },
  });

  if (!form) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const bank = (key) => (e) => setForm({ ...form, bank: { ...form.bank, [key]: e.target.value } });
  const planOptions = (plans?.plans ?? []).map((p) => ({ value: p.code, label: p.name }));

  return (
    <form className="grid gap-5 lg:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"><CalendarClock className="h-4 w-4" /></span>
            Trial & grace
          </CardTitle>
          <CardDescription>A shop gets the trial once, when it&apos;s verified. A paid plan keeps working for the grace days after it ends; after that the shop&apos;s vendor workspace is locked until it pays.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
          <SelectInput label="Trial plan" options={planOptions} value={form.trial_plan} onChange={(v) => setForm({ ...form, trial_plan: v })} disabled={!canEdit} error={errors.trial_plan?.[0]} />
          <NumberInput label="Trial days (0 = none)" value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: e.target.value })} min="0" disabled={!canEdit} error={errors.trial_days?.[0]} />
          <NumberInput label="Grace days" value={form.grace_days} onChange={(e) => setForm({ ...form, grace_days: e.target.value })} min="0" disabled={!canEdit} error={errors.grace_days?.[0]} />
          </div>
          <ol className="space-y-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            <li><span className="font-semibold text-foreground">1 · Verified</span> — {Number(form.trial_days) > 0 ? `${form.trial_days} days of ${planOptions.find((o) => o.value === form.trial_plan)?.label ?? form.trial_plan}, free.` : "no trial — the workspace stays locked until the shop pays."}</li>
            <li><span className="font-semibold text-foreground">2 · Pays</span> — sends a transfer receipt; you approve it under Payments and the plan runs for the periods paid.</li>
            <li><span className="font-semibold text-foreground">3 · Plan ends</span> — {Number(form.grace_days) > 0 ? `${form.grace_days} more days to renew, then locked.` : "locked straight away."} Listings stay live for customers; the vendor workspace opens again once a payment is approved.</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Landmark className="h-4 w-4" /></span>
            Platform bank account
          </CardTitle>
          <CardDescription>Shown to shops when they pay for a plan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Bank" value={form.bank.bank_name} onChange={bank("bank_name")} disabled={!canEdit} error={errors["bank.bank_name"]?.[0]} />
          <TextInput label="Branch" value={form.bank.branch} onChange={bank("branch")} disabled={!canEdit} error={errors["bank.branch"]?.[0]} />
          <TextInput label="Account name" value={form.bank.account_name} onChange={bank("account_name")} disabled={!canEdit} error={errors["bank.account_name"]?.[0]} />
          <TextInput label="Account number" value={form.bank.account_number} onChange={bank("account_number")} disabled={!canEdit} error={errors["bank.account_number"]?.[0]} />
          <TextareaInput className="sm:col-span-2" label="Instructions (optional)" rows={2} value={form.bank.instructions} onChange={bank("instructions")} disabled={!canEdit} placeholder="e.g. Use your shop name as the reference" error={errors["bank.instructions"]?.[0]} />
          <div className="rounded-xl border border-dashed p-3 text-sm sm:col-span-2">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Eye className="h-3.5 w-3.5" /> What shops see</p>
            {form.bank.account_number || form.bank.bank_name ? (
              <dl className="grid grid-cols-[7rem_1fr] gap-y-1">
                {form.bank.bank_name && <><dt className="text-muted-foreground">Bank</dt><dd>{form.bank.bank_name}{form.bank.branch ? ` · ${form.bank.branch}` : ""}</dd></>}
                {form.bank.account_name && <><dt className="text-muted-foreground">Account name</dt><dd>{form.bank.account_name}</dd></>}
                {form.bank.account_number && <><dt className="text-muted-foreground">Account no.</dt><dd className="font-mono">{form.bank.account_number}</dd></>}
                {form.bank.instructions && <p className="col-span-2 mt-1 text-xs text-muted-foreground">{form.bank.instructions}</p>}
              </dl>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">No account yet — shops can&apos;t pay for a plan until you add one.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="flex justify-end lg:col-span-2">
          <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save settings</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground lg:col-span-2">Only the Platform Owner can change these.</p>
      )}
    </form>
  );
}
