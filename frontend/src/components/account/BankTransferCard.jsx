"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { CustomerPaymentsList } from "@/components/account/CustomerPaymentsList";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput, TextInput, ValidationError } from "@/components/forms/FormField";
import { Copy, Landmark, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const OPTION_LABEL = { advance: "Minimum advance", full: "Full amount", balance: "Remaining balance" };


/**
 * Bank transfer to the shop: its account, the receipt upload (advance or
 * full, up to the balance) and every transfer with its review status. An
 * upload only counts once the shop verifies it against its own statement.
 */
export function BankTransferCard({ booking }) {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const reference = booking.booking_reference;
  const bank = booking.bank_details;
  const balance = Number(booking.balance_due ?? 0);
  // Quick picks (advance / full, then the balance) — or any amount from the minimum up to the balance.
  const options = booking.transfer_options ?? [];
  const minimum = Number(booking.minimum_transfer ?? balance);
  const awaitingReview = (booking.payments ?? []).some((p) => p.method === "bank" && p.status === "pending");
  const canUpload = booking.status === "confirmed" && balance > 0 && !awaitingReview;

  const [amount, setAmount] = useState(options[0]?.amount != null ? String(options[0].amount) : "");
  const [transferRef, setTransferRef] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("amount", String(amount));
      if (transferRef) fd.append("transfer_reference", transferRef);
      fd.append("proof", file);
      return customerService.bookings.submitTransfer(reference, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-booking", reference] });
      setFile(null);
      setTransferRef("");
      setErrors({});
      toast.success("Receipt uploaded — the shop will check it");
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {};
      setErrors(apiErrors);
      if (!Object.keys(apiErrors).length) toast.error(err.response?.data?.message ?? "Could not upload the receipt");
    },
  });

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success("Copied"));

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Landmark className="h-4 w-4" /></div>
        <div>
          <CardTitle className="text-base">Bank Transfer</CardTitle>
          <CardDescription>
            Paid {format(booking.amount_paid ?? 0)} · balance {format(balance)}{balance > 0 && booking.status === "confirmed" ? " (anything left is paid at pickup)" : ""}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {bank && balance > 0 && (
          <div className="grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Account holder</p><p className="font-medium">{bank.account_holder_name}</p></div>
            <div><p className="text-xs text-muted-foreground">Bank / branch</p><p className="font-medium">{bank.bank_name}{bank.branch_name ? ` — ${bank.branch_name}` : ""}</p></div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Account number</p>
              <p className="flex items-center gap-2 font-mono text-base font-semibold">
                {bank.account_number}
                <button type="button" onClick={() => copy(bank.account_number)} className="text-muted-foreground hover:text-foreground" aria-label="Copy account number"><Copy className="h-4 w-4" /></button>
              </p>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Use <span className="font-mono font-medium text-foreground">{reference}</span> as the transfer reference.</p>
          </div>
        )}

        {canUpload && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(amount);
              if (!amount || value < minimum || value > balance) {
                setErrors({ amount: [minimum >= balance
                  ? `Transfer the full ${format(balance)}.`
                  : `Enter an amount between ${format(minimum)} and ${format(balance)}.`] });
                return;
              }
              if (!file) { setErrors({ proof: ["Attach the transfer receipt (PDF or image)."] }); return; }
              upload.mutate();
            }}
          >
            <ValidationError errors={errors} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <p className="text-sm font-medium">How much are you transferring?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setAmount(String(o.amount))}
                      aria-pressed={Number(amount) === o.amount}
                      className={cn(
                        "flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors",
                        Number(amount) === o.amount ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                      )}
                    >
                      <span className="font-semibold">{format(o.amount)}</span>
                      <span className="text-xs text-muted-foreground">{OPTION_LABEL[o.key]}</span>
                    </button>
                  ))}
                </div>
                <NumberInput
                  label={minimum < balance ? `Or enter an amount (${format(minimum)} – ${format(balance)})` : "Amount"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={minimum}
                  max={balance}
                  step="0.01"
                  readOnly={minimum >= balance}
                  error={errors.amount?.[0]}
                />
              </div>
              <TextInput label="Bank reference (optional)" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} error={errors.transfer_reference?.[0]} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Receipt (PDF or image, max 5 MB)</p>
              <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {errors.proof?.[0] && <p className="text-xs text-destructive">{errors.proof[0]}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="submit" size="sm" className="gap-1.5" disabled={upload.isPending}>
                {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload receipt
              </Button>
            </div>
          </form>
        )}
        {awaitingReview && <p className="rounded-lg bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-400">Your receipt is with the shop — they&apos;ll confirm once the money shows in their account.</p>}

        <CustomerPaymentsList booking={booking} />
      </CardContent>
    </Card>
  );
}
