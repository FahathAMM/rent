"use client";

import { customerService } from "@/services/customerService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Banknote, FileText, Landmark, ReceiptText } from "lucide-react";
import { cn, formatDateTime, openBlob } from "@/lib/utils";
import { isMoneyLine, lineDelta } from "@/lib/statement";
import { toast } from "sonner";

const UPLOAD_STATUS = { pending: "Waiting for the shop to check", succeeded: "Received by the shop", failed: "Not confirmed", cancelled: "Closed" };

/** A statement line in the customer's words. */
function describe(p) {
  if (p.type === "booking_charge") return "Your booking (rental)";
  if (p.type === "security_deposit" && !isMoneyLine(p)) return "Security deposit (refundable)";
  if (p.type === "adjustment") return Number(p.debit) > 0 ? "Price increased (dates changed)" : "Price reduced / charge cancelled";
  // Deposit settled when you returned the vehicle.
  if (p.type === "deposit_release") return "Security deposit settled at return";
  if (p.type === "damage") return p.note ? `Kept from your deposit — ${p.note}` : "Kept from your deposit for damage";
  if (isMoneyLine(p) && Number(p.debit) > 0) return p.type === "security_deposit" ? "Deposit handed back to you (cash)" : "Paid back to you";
  const what = p.method === "bank" ? "Your bank transfer" : "Cash paid to the shop";
  return p.status === "succeeded" ? what : `${what} · ${UPLOAD_STATUS[p.status] ?? p.status}`;
}

/**
 * Every payment on a booking paid to the shop — the customer's own transfer
 * uploads, payments the shop recorded for them, and cash taken at pickup —
 * so the customer sees the same history the shop does.
 */
export function CustomerPaymentsList({ booking }) {
  const { format } = useCurrencyFormat();
  const payments = booking.payments ?? [];

  const viewProof = (paymentId) => {
    const tab = window.open("", "_blank");
    customerService.bookings.transferProof(booking.booking_reference, paymentId)
      .then((res) => openBlob(res.data, tab))
      .catch(() => { tab?.close(); toast.error("Could not open the receipt"); });
  };

  if (!payments.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your statement</p>
      {payments.map((p) => (
        <div key={p.id} className={cn("flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm", !isMoneyLine(p) && "bg-muted/40")}>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              {!isMoneyLine(p) ? <ReceiptText className="h-3.5 w-3.5" /> : p.method === "bank" ? <Landmark className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}
              {describe(p)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(p.paid_at ?? p.created_at)}
              {p.transfer_reference ? ` · ref ${p.transfer_reference}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {isMoneyLine(p) && p.status !== "succeeded" && <StatusBadge status={p.status} />}
            {p.has_proof && (
              <Button type="button" variant="ghost" size="icon" onClick={() => viewProof(p.id)} aria-label="View receipt"><FileText className="h-4 w-4" /></Button>
            )}
            <div className="text-right tabular-nums">
              <p className={cn("font-medium", lineDelta(p) < 0 && "text-emerald-600")}>{lineDelta(p) > 0 ? "+" : "−"}{format(p.amount)}</p>
              {p.balance != null && <p className="text-xs text-muted-foreground">owed {format(p.balance)}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
