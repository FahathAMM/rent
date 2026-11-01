"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, FileUp, Landmark, Loader2, X } from "lucide-react";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TextInput } from "@/components/forms/FormField";
import { cn } from "@/lib/utils";
import { periodLabel } from "./planStyle";
import { toast } from "sonner";

const PERIODS = [1, 3, 6, 12];

/** Transfer to the platform's account, then upload the receipt — the platform approves it and the plan starts. */
export function PayDialog({ plan, bank, open, onOpenChange, onPaid }) {
  const { format } = useCurrencyFormat();
  const [periods, setPeriods] = useState(1);
  const [reference, setReference] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});

  const reset = () => { setReference(""); setFile(null); setErrors({}); setPeriods(1); };

  const pay = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("plan_id", plan.id);
      fd.append("periods", String(periods));
      if (reference) fd.append("bank_reference", reference);
      if (file) fd.append("proof", file);
      return vendorService.subscription.pay(fd);
    },
    onSuccess: (res) => {
      toast.success(res.data.message ?? "Payment sent");
      reset();
      onPaid?.();
      onOpenChange(false);
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (!err.response?.data?.errors) toast.error(err.response?.data?.message ?? "Could not send the payment");
    },
  });

  if (!plan) return null;
  const total = Number(plan.price) * periods;
  const hasBank = bank && (bank.account_number || bank.bank_name);
  const unit = periodLabel(plan.period_days);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pay for {plan.name}</DialogTitle>
          <DialogDescription>{format(plan.price)} per {unit}. Transfer the total, then upload the receipt — the platform confirms it.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
          {/* How long */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">How long</p>
            <div className="grid grid-cols-4 gap-2">
              {PERIODS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPeriods(n)}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-center transition-colors",
                    periods === n ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50",
                  )}
                >
                  <span className="block text-base font-semibold leading-tight">{n}</span>
                  <span className="block text-[10px] text-muted-foreground">{unit}{n === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
            {errors.periods?.[0] && <p className="text-xs text-destructive">{errors.periods[0]}</p>}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3">
            <span className="text-sm text-muted-foreground">Amount to transfer</span>
            <span className="text-2xl font-bold tabular-nums">{format(total)}</span>
          </div>

          {/* Where to */}
          <div className="rounded-xl border p-3 text-sm">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Landmark className="h-3.5 w-3.5" /> Transfer to</p>
            {hasBank ? (
              <dl className="grid grid-cols-[7.5rem_1fr] items-center gap-y-1.5">
                {bank.bank_name && <><dt className="text-muted-foreground">Bank</dt><dd>{bank.bank_name}{bank.branch ? ` · ${bank.branch}` : ""}</dd></>}
                {bank.account_name && <><dt className="text-muted-foreground">Account name</dt><dd>{bank.account_name}</dd></>}
                {bank.account_number && (
                  <>
                    <dt className="text-muted-foreground">Account no.</dt>
                    <dd className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold">{bank.account_number}</span>
                      <button type="button" onClick={() => copy(bank.account_number)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Copy"><Copy className="h-3.5 w-3.5" /></button>
                    </dd>
                  </>
                )}
                {bank.instructions && <p className="col-span-2 mt-1 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">{bank.instructions}</p>}
              </dl>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">The platform hasn&apos;t added its bank account yet — please contact the platform admin.</p>
            )}
          </div>

          <TextInput label="Bank reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="From your bank slip or app" error={errors.bank_reference?.[0]} />

          {/* Receipt */}
          <div className="space-y-1">
            <p className="text-sm font-medium">Receipt</p>
            {file ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2"><FileUp className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{file.name}</span></span>
                <button type="button" onClick={() => setFile(null)} className="rounded p-1 text-muted-foreground hover:bg-muted" title="Remove"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-3 py-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
                <FileUp className="h-5 w-5" />
                <span><span className="font-medium text-primary">Choose a file</span> — PDF or image, up to 5 MB</span>
                <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
            {errors.proof?.[0] && <p className="text-xs text-destructive">{errors.proof[0]}</p>}
            {errors.plan_id?.[0] && <p className="text-xs text-destructive">{errors.plan_id[0]}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={pay.isPending || !file || !hasBank}>
              {pay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send payment of {format(total)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
