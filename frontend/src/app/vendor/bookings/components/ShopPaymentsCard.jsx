"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NumberInput, TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Banknote, CheckCircle2, FileText, Landmark, Loader2, Plus, ReceiptText, Wallet, XCircle } from "lucide-react";
import { cn, formatDateTime, fromAppDateTimeInput, openBlob, toAppDateTimeInput } from "@/lib/utils";
import { isMoneyLine, lineDelta, lineLabel, statementSummary } from "@/lib/statement";
import { toast } from "sonner";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
];

/**
 * Every payment on a cash / bank-transfer booking: the customer's uploaded
 * receipts (checked against the shop's bank statement, then verified or
 * rejected), payments the shop records itself, and cash taken at handover.
 * Only succeeded payments count towards what has been received.
 */
export function ShopPaymentsCard({ booking, canEdit, onChanged, summaryExtra, depositExtra }) {
  const { format } = useCurrencyFormat();
  const reference = booking.booking_reference;
  const [rejecting, setRejecting] = useState(null); // payment id
  const [recording, setRecording] = useState(false);
  const payments = booking.payments ?? [];
  const open = ["confirmed", "active"].includes(booking.status);
  // An extended rental can still owe a balance after the vehicle is back.
  const canRecord = open || booking.status === "completed";
  const balance = Number(booking.balance_due ?? 0);
  const summary = statementSummary(payments);

  const onError = (fallback) => (err) => toast.error(err.response?.data?.errors?.status?.[0] ?? err.response?.data?.message ?? fallback);
  const verify = useMutation({
    mutationFn: (id) => vendorService.bookings.verifyTransfer(reference, id),
    onSuccess: () => { onChanged(); toast.success("Transfer verified"); },
    onError: onError("Could not verify the transfer"),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }) => vendorService.bookings.rejectTransfer(reference, id, reason),
    onSuccess: () => { onChanged(); setRejecting(null); toast.success("Transfer rejected — the customer can upload a new receipt"); },
    onError: onError("Could not reject the transfer"),
  });

  const viewProof = (id) => {
    const tab = window.open("", "_blank");
    vendorService.bookings.transferProof(reference, id)
      .then((res) => openBlob(res.data, tab))
      .catch(() => { tab?.close(); toast.error("Could not open the receipt"); });
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Payments & statement</CardTitle>
          <CardDescription>
            Received {format(booking.amount_paid ?? 0)} · {format(balance)} still due{balance > 0 && booking.status === "confirmed" ? " (collect any rest in cash at handover)" : ""}.
            {booking.payment_method === "bank_transfer" && " Check your bank account before verifying a receipt."}
          </CardDescription>
        </div>
        {canEdit && canRecord && balance > 0 && (
          <Button size="sm" className="gap-1.5" onClick={() => setRecording(true)}><Plus className="h-3.5 w-3.5" /> Record payment</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {/* Summary and history side by side (stacked on small screens). */}
        {/* Summary is a fixed narrow column; the statement takes the rest. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
            {/* Price breakdown and earnings (from BookingDetail). */}
            {summaryExtra && <div className="space-y-4">{summaryExtra}</div>}
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">History <span className="font-normal">· {payments.length} lines</span></p>
            {!payments.length && <p className="text-muted-foreground">No statement lines yet.</p>}
            {payments.length > 0 && (
              // One compact table: everything for a line (receipt, verify/reject) sits on its own row; long statements scroll inside the card.
              <div className="max-h-[26rem] overflow-y-auto rounded-lg border">
                <div className="sticky top-0 z-10 hidden grid-cols-[1fr_6.5rem_6.5rem_6.5rem] gap-2 border-b bg-muted/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur sm:grid">
                  <span>Statement</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span className="text-right">Balance</span>
                </div>
                <div className="divide-y">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className={cn("grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5 sm:grid-cols-[1fr_6.5rem_6.5rem_6.5rem]", !isMoneyLine(p) && "bg-muted/30")}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-muted-foreground">
                          {!isMoneyLine(p) ? <ReceiptText className="h-3.5 w-3.5" /> : p.method === "bank" ? <Landmark className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium leading-tight">{lineLabel(p)}</p>
                          <p className="truncate text-[11px] leading-tight text-muted-foreground">
                            {formatDateTime(p.paid_at ?? p.created_at)}
                            {p.transfer_reference ? ` · ref ${p.transfer_reference}` : ""}
                          </p>
                        </div>
                        {/* Inline actions — same row, no extra line. */}
                        <div className="flex shrink-0 items-center gap-1">
                          {isMoneyLine(p) && p.status !== "succeeded" && <StatusBadge status={p.status} />}
                          {p.has_proof && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="View receipt" aria-label="View receipt" onClick={() => viewProof(p.id)}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canEdit && open && p.status === "pending" && (
                            <>
                              <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => verify.mutate(p.id)} disabled={verify.isPending}>
                                {verify.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Verify
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" title="Reject" aria-label="Reject" onClick={() => setRejecting(p.id)}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="hidden text-right tabular-nums sm:block">{Number(p.debit) > 0 ? format(p.debit) : ""}</span>
                      <span className="hidden text-right tabular-nums text-emerald-600 sm:block">{Number(p.credit) > 0 ? format(p.credit) : ""}</span>
                      <span className="text-right font-semibold tabular-nums leading-tight">
                        {/* Mobile: the line's own effect above the balance. */}
                        <span className={cn("block text-[11px] font-normal sm:hidden", lineDelta(p) > 0 ? "" : "text-emerald-600")}>{lineDelta(p) > 0 ? "+" : "−"}{format(p.amount)}</span>
                        {p.balance != null ? format(p.balance) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {payments.length > 0 && (
              // Money side only — what's charged is the Price breakdown on the left.
              <div className="space-y-1.5 rounded-lg border p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payments</p>
                <SummaryLine l="Received" v={format(summary.received)} tone="text-emerald-600" />
                {summary.paidBack > 0 && <SummaryLine l="Paid back to customer" v={`−${format(summary.paidBack)}`} />}
                {summary.pendingCount > 0 && (
                  <SummaryLine l={`Waiting for you to check (${summary.pendingCount})`} v={format(summary.pendingAmount)} tone="text-amber-600" />
                )}
                <SummaryLine
                  l={summary.balance < 0 ? "You hold for the customer" : summary.balance > 0 ? "Still owed" : "Settled"}
                  v={format(Math.abs(summary.balance))}
                  strong
                  tone={summary.balance > 0 ? "text-amber-700 dark:text-amber-400" : summary.balance < 0 ? "text-sky-700 dark:text-sky-400" : "text-emerald-600"}
                />
              </div>
            )}
            {/* Security deposit card (from BookingDetail). */}
            {depositExtra}
          </div>
        </div>
      </CardContent>

      <ReasonDialog
        open={rejecting !== null}
        onOpenChange={(v) => !v && setRejecting(null)}
        title="Reject Transfer"
        description="Tell the customer why — e.g. the money hasn't arrived or the amount doesn't match. They can upload a new receipt."
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate({ id: rejecting, reason })}
      />

      {recording && (
        <RecordPaymentDialog
          booking={booking}
          balance={balance}
          onClose={() => setRecording(false)}
          onSaved={() => { setRecording(false); onChanged(); }}
        />
      )}
    </Card>
  );
}

/** "YYYY-MM-DDTHH:mm" in the browser's local time — the max a datetime-local input accepts for "now". */
function nowLocal() {
  return toAppDateTimeInput(new Date());
}

/** Mounted only while open, so every opening starts from a clean form. */
function RecordPaymentDialog({ booking, balance, onClose, onSaved }) {
  const { format } = useCurrencyFormat();
  const [form, setForm] = useState({
    method: booking.payment_method === "bank_transfer" ? "bank_transfer" : "cash",
    amount: String(balance),
    paid_at: "",
    reference: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== "" && fd.append(k, v));
      // datetime-local has no zone; interpret it consistently as Sri Lanka time.
      if (form.paid_at) fd.set("paid_at", fromAppDateTimeInput(form.paid_at));
      if (file) fd.append("proof", file);
      return vendorService.bookings.recordPayment(booking.booking_reference, fd);
    },
    onSuccess: () => { toast.success("Payment recorded"); onSaved(); },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {};
      setErrors(apiErrors);
      if (!Object.keys(apiErrors).length) toast.error(err.response?.data?.message ?? "Could not record the payment");
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const value = Number(form.amount);
    if (!value || value < 1 || value > balance) {
      setErrors({ amount: [`Enter an amount up to the ${format(balance)} still due.`] });
      return;
    }
    if (form.paid_at && Date.parse(fromAppDateTimeInput(form.paid_at)) > Date.now()) {
      setErrors({ paid_at: ["The date received can't be in the future."] });
      return;
    }
    setErrors({});
    save.mutate();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Money you already received for {booking.booking_reference} — it counts straight away and the customer is notified.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <ValidationError errors={errors} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput label="Method" value={form.method} onChange={(v) => setForm((p) => ({ ...p, method: v }))} options={METHODS} error={errors.method?.[0]} />
            <NumberInput label={`Amount (up to ${format(balance)})`} value={form.amount} onChange={fi("amount")} min="1" max={balance} step="0.01" error={errors.amount?.[0]} />
            <TextInput label="Date received (optional)" type="datetime-local" value={form.paid_at} onChange={fi("paid_at")} max={nowLocal()} error={errors.paid_at?.[0]} />
            <TextInput label="Reference (optional)" value={form.reference} onChange={fi("reference")} placeholder={form.method === "bank_transfer" ? "Bank reference" : "Receipt no."} error={errors.reference?.[0]} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Receipt (optional, PDF or image, max 5 MB)</p>
            <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {errors.proof?.[0] && <p className="text-xs text-destructive">{errors.proof[0]}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryLine({ l, v, strong, tone }) {
  return (
    <div className={cn("flex justify-between gap-3 tabular-nums", strong && "border-t pt-1.5 font-semibold", tone)}>
      <span className={cn(!strong && !tone && "text-muted-foreground")}>{l}</span>
      <span>{v}</span>
    </div>
  );
}
