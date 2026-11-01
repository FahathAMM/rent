"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Copy, FileUp, Landmark, Loader2, MapPin, X } from "lucide-react";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SelectInput } from "@/components/forms/SelectInput";
import { TextInput } from "@/components/forms/FormField";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const COPY = {
  featured: {
    title: "Feature a vehicle",
    description: "This vehicle comes first in vehicle search — in every sort, whenever it matches the customer's filters — and shows on the home page with a Featured badge.",
  },
  sponsored: {
    title: "Sponsor your shop",
    description: "Your shop comes first on the Shops page — for everyone, and when customers filter by your city — with a Sponsored label.",
  },
};

/** Pick what to promote and a package, transfer to the platform, upload the receipt. */
export function PromoteDialog({ type, data, open, onOpenChange, onPaid, presetVehicleId }) {
  const { format } = useCurrencyFormat();
  const packages = (data?.packages ?? []).filter((p) => p.type === type);
  const [vehicleId, setVehicleId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});

  // Fresh form each time it opens; pre-pick the first package (and a vehicle, if one was clicked).
  useEffect(() => {
    if (!open) return;
    setVehicleId(presetVehicleId ? String(presetVehicleId) : "");
    setPackageId(packages[0] ? String(packages[0].id) : "");
    setReference("");
    setFile(null);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  // Featured: the picked vehicle. Sponsored: always the shop's own city (nothing to pick).
  const target = type === "featured" ? (vehicleId ? { vehicle_id: vehicleId } : null) : (data?.city ? {} : null);

  // When it would start if approved now (slots may all be taken).
  const { data: slot, isFetching: checking } = useQuery({
    queryKey: ["vendor-promotion-availability", type, packageId, target],
    queryFn: () => vendorService.promotions.availability({ package_id: packageId, ...target }).then((r) => r.data.data),
    enabled: open && !!packageId && !!target,
    retry: false,
  });

  const pay = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("package_id", packageId);
      Object.entries(target ?? {}).forEach(([k, v]) => fd.append(k, v));
      if (reference) fd.append("bank_reference", reference);
      if (file) fd.append("proof", file);
      return vendorService.promotions.pay(fd);
    },
    onSuccess: (res) => {
      toast.success(res.data.message ?? "Payment sent");
      onPaid?.();
      onOpenChange(false);
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (!err.response?.data?.errors) toast.error(err.response?.data?.message ?? "Could not send the payment");
    },
  });

  const pkg = packages.find((p) => String(p.id) === packageId);
  const bank = data?.bank ?? {};
  const hasBank = bank.account_number || bank.bank_name;
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast.error("Could not copy"); }
  };
  const vehicleOptions = (data?.vehicles ?? []).map((v) => ({ value: String(v.id), label: v.is_featured ? `${v.title} · featured now` : v.title }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{COPY[type]?.title}</DialogTitle>
          <DialogDescription>{COPY[type]?.description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
          {/* 1 · What */}
          {type === "featured" ? (
            <SelectInput label="Vehicle" required options={vehicleOptions} value={vehicleId} onChange={setVehicleId} placeholder="Pick a published vehicle" error={errors.vehicle_id?.[0]} />
          ) : (
            <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {data?.city
                ? <span>Sponsored in <b>{data.city}</b> — your shop comes first on the Shops page, including when customers look for shops in {data.city}.</span>
                : <span className="text-amber-700 dark:text-amber-400">Add your city in Settings → Shop Profile first.</span>}
              {errors.city?.[0] && <span className="text-xs text-destructive">{errors.city[0]}</span>}
            </div>
          )}

          {/* 2 · How long */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Package</p>
            <div className="grid grid-cols-2 gap-2">
              {packages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPackageId(String(p.id))}
                  className={cn("rounded-xl border px-3 py-2.5 text-left transition-colors", packageId === String(p.id) ? "border-primary bg-primary/10" : "hover:bg-muted/50")}
                >
                  <span className="block text-lg font-semibold leading-tight">{p.days} days</span>
                  <span className="block text-sm tabular-nums text-muted-foreground">{format(p.price)}</span>
                </button>
              ))}
            </div>
            {!packages.length && <p className="text-sm text-muted-foreground">No packages on offer right now.</p>}
          </div>

          {/* When it would run */}
          {pkg && target && (
            <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm", slot?.starts_now === false ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300" : "bg-muted/40")}>
              {checking ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : slot?.starts_now === false ? <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              <span>
                {checking || !slot ? "Checking available slots…"
                  : slot.starts_now ? `Goes live as soon as the platform confirms your payment, for ${pkg.days} days.`
                  : `All slots are taken right now — if approved today it runs ${formatDateTime(slot.starts_at)} → ${formatDateTime(slot.ends_at)}.`}
              </span>
            </div>
          )}

          {/* 3 · Pay */}
          <div className="rounded-xl border p-3 text-sm">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Landmark className="h-3.5 w-3.5" /> Transfer {pkg ? format(pkg.price) : ""} to</p>
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
              </dl>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">The platform hasn&apos;t added its bank account yet — please contact the platform admin.</p>
            )}
          </div>

          <TextInput label="Bank reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="From your bank slip or app" error={errors.bank_reference?.[0]} />

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
            {errors.package_id?.[0] && <p className="text-xs text-destructive">{errors.package_id[0]}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pay.isPending || !file || !hasBank || !pkg || !target}>
              {pay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send payment{pkg ? ` of ${format(pkg.price)}` : ""}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
