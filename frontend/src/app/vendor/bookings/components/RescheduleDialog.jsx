"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

/** ISO → "YYYY-MM-DDTHH:mm" in the browser's local time, for a datetime-local input. */
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** datetime-local value (local, no zone) → UTC ISO for the API, which runs in UTC. */
const toIso = (local) => (local ? new Date(local).toISOString() : null);

/**
 * Change a confirmed booking's pickup/return (shop only, before handover).
 * Same booking and payments; the price is recalculated from the rates the
 * customer was quoted. A live preview shows the new total, what's paid and
 * whether the vehicle is free before anything is saved.
 */
export function RescheduleDialog({ booking, onClose, onSaved }) {
  const { format } = useCurrencyFormat();
  const reference = booking.booking_reference;
  const [pickup, setPickup] = useState(toLocalInput(booking.pickup_at));
  const [ret, setRet] = useState(toLocalInput(booking.return_at));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});

  const unchanged = pickup === toLocalInput(booking.pickup_at) && ret === toLocalInput(booking.return_at);
  const valid = pickup && ret && new Date(ret) > new Date(pickup) && new Date(pickup) > new Date();

  const preview = useQuery({
    queryKey: ["reschedule-preview", reference, pickup, ret],
    queryFn: () => vendorService.bookings.previewReschedule(reference, { pickup_at: toIso(pickup), return_at: toIso(ret) }).then((r) => r.data.data),
    enabled: !!valid && !unchanged,
    retry: false,
  });
  const previewError = preview.error?.response?.data?.errors
    ? Object.values(preview.error.response.data.errors).flat()[0]
    : preview.error?.response?.data?.message;
  const p = preview.data;

  const save = useMutation({
    mutationFn: () => vendorService.bookings.reschedule(reference, { pickup_at: toIso(pickup), return_at: toIso(ret), reason: reason || undefined }),
    onSuccess: () => { toast.success("Booking dates changed — the customer has been notified"); onSaved(); },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {};
      setErrors(apiErrors);
      if (!Object.keys(apiErrors).length) toast.error(err.response?.data?.message ?? "Could not change the dates");
    },
  });

  const canSave = valid && !unchanged && p?.available && !preview.isFetching && !save.isPending;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Change dates</DialogTitle>
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
            <TextInput label="New pickup" type="datetime-local" value={pickup} min={toLocalInput(new Date().toISOString())} onChange={(e) => setPickup(e.target.value)} error={errors.pickup_at?.[0]} />
            <TextInput label="New return" type="datetime-local" value={ret} min={pickup || undefined} onChange={(e) => setRet(e.target.value)} error={errors.return_at?.[0]} />
          </div>
          <TextInput label="Reason (optional, shown to the customer)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="e.g. Customer's flight was moved" error={errors.reason?.[0]} />

          {/* Live preview */}
          <div className="min-h-[92px] rounded-lg border bg-muted/30 p-3 text-sm">
            {unchanged ? (
              <p className="text-muted-foreground">Pick the new pickup and return to see the new price.</p>
            ) : !valid ? (
              <p className="text-destructive">The return must be after the pickup, and the pickup in the future.</p>
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
                  <div className="flex justify-between font-medium text-amber-700 dark:text-amber-400"><span>Customer overpaid — refund per your policy</span><span>{format(p.overpaid)}</span></div>
                ) : (
                  <div className="flex justify-between font-medium"><span>New balance due</span><span>{format(p.balance_due)}</span></div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canSave}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change dates
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
