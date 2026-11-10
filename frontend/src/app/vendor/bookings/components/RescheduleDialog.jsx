"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckboxInput, TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { cn, formatDateTime, fromAppDateTimeInput, toAppDateTimeInput } from "@/lib/utils";
import { toast } from "sonner";
import { PriceBreakdownDialog, breakdownData } from "@/components/shared/PriceBreakdownDialog";

const REFUND_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
];

/**
 * Change a booking's dates (shop only): pickup and return before handover,
 * just the return after it (extend or shorten the rental). Same booking and
 * payments; the price is recalculated from the rates the customer was quoted.
 * A live preview shows the new total, what's paid and whether the vehicle is
 * free before anything is saved. Shortening a handed-over rental means paying
 * the difference back, which the shop confirms here.
 */
export function RescheduleDialog({ booking, onClose, onSaved }) {
  const { format } = useCurrencyFormat();
  const reference = booking.booking_reference;
  const active = booking.status === "active";
  const [pickup, setPickup] = useState(toAppDateTimeInput(booking.pickup_at));
  const [ret, setRet] = useState(toAppDateTimeInput(booking.return_at));
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("");
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [errors, setErrors] = useState({});

  const unchanged = pickup === toAppDateTimeInput(booking.pickup_at) && ret === toAppDateTimeInput(booking.return_at);
  const pickupInstant = pickup ? Date.parse(fromAppDateTimeInput(pickup)) : NaN;
  const returnInstant = ret ? Date.parse(fromAppDateTimeInput(ret)) : NaN;
  const valid = pickup && ret && returnInstant > pickupInstant && (active || pickupInstant > Date.now());

  const preview = useQuery({
    queryKey: ["reschedule-preview", reference, pickup, ret],
    queryFn: () => vendorService.bookings.previewReschedule(reference, { pickup_at: fromAppDateTimeInput(pickup), return_at: fromAppDateTimeInput(ret) }).then((r) => r.data.data),
    enabled: !!valid && !unchanged,
    retry: false,
  });
  const previewError = preview.error?.response?.data?.errors
    ? Object.values(preview.error.response.data.errors).flat()[0]
    : preview.error?.response?.data?.message;
  const p = preview.data;
  const refundDue = active && p?.overpaid > 0;

  const save = useMutation({
    mutationFn: () => vendorService.bookings.reschedule(reference, {
      pickup_at: fromAppDateTimeInput(pickup),
      return_at: fromAppDateTimeInput(ret),
      reason: reason || undefined,
      refund_method: refundDue ? refundMethod : undefined,
    }),
    onSuccess: () => { toast.success(`${active ? "Return date" : "Booking dates"} changed — the customer has been notified`); onSaved(); },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {};
      setErrors(apiErrors);
      if (!Object.keys(apiErrors).length) toast.error(err.response?.data?.message ?? "Could not change the dates");
    },
  });

  const canSave = valid && !unchanged && p?.available && !preview.isFetching && !save.isPending && (!refundDue || (refundMethod && refundConfirmed));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> {active ? "Change return date" : "Change dates"}</DialogTitle>
          <DialogDescription>
            Currently {formatDateTime(booking.pickup_at)} → {formatDateTime(booking.return_at)}. Payments stay on this booking; the price uses the rates the customer was quoted.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); if (canSave) { setErrors({}); save.mutate(); } }}
        >
          <ValidationError errors={errors} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label={active ? "Pickup" : "New pickup"} type="datetime-local" value={pickup} min={active ? undefined : toAppDateTimeInput(new Date())} disabled={active} onChange={(e) => setPickup(e.target.value)} error={errors.pickup_at?.[0]} />
            <TextInput label="New return" type="datetime-local" value={ret} min={pickup || undefined} onChange={(e) => setRet(e.target.value)} error={errors.return_at?.[0]} />
          </div>
          <TextInput label="Reason (optional, shown to the customer)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="e.g. Customer's flight was moved" error={errors.reason?.[0]} />

          {/* Live preview */}
          <div className="min-h-[92px] rounded-lg border bg-muted/30 p-3 text-sm">
            {unchanged ? (
              <p className="text-muted-foreground">{active ? "Pick the new return to see the new price." : "Pick the new pickup and return to see the new price."}</p>
            ) : !valid ? (
              <p className="text-destructive">{active ? "The return must be after the pickup." : "The return must be after the pickup, and the pickup in the future."}</p>
            ) : preview.isFetching && !p ? (
              <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking availability and price…</p>
            ) : previewError ? (
              <p className="flex items-start gap-2 text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {previewError}</p>
            ) : p ? (
              <div className="space-y-1.5">
                <p className={cn("flex items-center gap-2 font-medium", p.available ? "text-emerald-600" : "text-destructive")}>
                  {p.available ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {p.available ? `Vehicle is free · ${p.rental_days} day${p.rental_days === 1 ? "" : "s"}` : p.conflict}
                </p>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{format(p.current_total)} → <span className="font-semibold">{format(p.new_total)}</span></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Already paid</span><span>{format(p.amount_paid)}</span></div>
                {p.overpaid > 0 ? (
                  <div className="flex justify-between font-medium text-amber-700 dark:text-amber-400"><span>{active ? "Pay back to the customer" : "Customer overpaid — refund per your policy"}</span><span>{format(p.overpaid)}</span></div>
                ) : (
                  <div className="flex justify-between font-medium"><span>New balance due</span><span>{format(p.balance_due)}</span></div>
                )}
                {active && p.balance_due > 0 && <p className="text-xs text-muted-foreground">Collect it with Record payment after saving.</p>}
                {p.breakdown && (
                  <PriceBreakdownDialog
                    format={format}
                    from={fromAppDateTimeInput(pickup)}
                    to={fromAppDateTimeInput(ret)}
                    data={breakdownData(p.breakdown, p.rental_days, "New total")}
                    extraRows={[
                      { label: "Previous total", amount: p.current_total },
                      { label: "Already paid", amount: p.amount_paid },
                      p.overpaid > 0
                        ? { label: active ? "Pay back to the customer" : "Customer overpaid", amount: p.overpaid, strong: true, tone: "warn" }
                        : { label: "New balance due", amount: p.balance_due, strong: true },
                    ]}
                  />
                )}
              </div>
            ) : null}
          </div>

          {refundDue && p.available && (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <SelectInput label="Paid back by" value={refundMethod} onChange={setRefundMethod} options={REFUND_METHODS} error={errors.refund_method?.[0]} />
              <CheckboxInput label={`I have paid ${format(p.overpaid)} back to the customer`} checked={refundConfirmed} onChange={(v) => setRefundConfirmed(!!v)} />
              <p className="text-xs text-muted-foreground">Keeping the full price? Close this and use Record return — the date doesn&apos;t need changing.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canSave}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {active ? "Change return date" : "Change dates"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
