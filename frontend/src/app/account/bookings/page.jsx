"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { customerService } from "@/services/customerService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { Loader2, CalendarCheck, ChevronRight, ChevronLeft, Car, Banknote, Landmark, Hourglass, CalendarClock, CheckCircle2, Wallet } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

/** What the customer should do next on a paid-to-shop booking — null when there's nothing to flag. */
function paymentHint(b, format) {
  if (!["confirmed", "active"].includes(b.status) || b.balance_due == null) return null;
  const due = Number(b.balance_due);
  if (due <= 0) return { tone: "ok", text: "Fully paid" };
  if (b.payment_method === "bank_transfer") {
    if ((b.payments ?? []).some((p) => p.status === "pending")) return { tone: "wait", text: "Receipt waiting for the shop" };
    if (b.status === "confirmed") return { tone: "act", text: Number(b.amount_paid) > 0 ? `${format(due)} left — transfer or pay at pickup` : "Upload your transfer receipt" };
  }
  return { tone: "wait", text: `${format(due)} due at pickup` };
}

const HINT_TONE = { ok: "text-emerald-600", wait: "text-muted-foreground", act: "font-medium text-amber-600" };

const STATUS_OPTIONS = [
  { value: "", label: "All bookings" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "cancelled_by_customer", label: "Cancelled by me" },
  { value: "cancelled_by_owner", label: "Cancelled by owner" },
];

export default function AccountBookingsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { format } = useCurrencyFormat();

  // Counts across all bookings for the tiles (the list below is one filtered page).
  const { data: summary } = useQuery({
    queryKey: ["my-bookings-summary"],
    queryFn: () => customerService.bookings.summary().then((r) => r.data.data),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings", status, page],
    queryFn: () => customerService.bookings.getAll({ status: status || undefined, page }).then((r) => r.data.record),
  });

  const bookings = data?.data ?? [];

  return (
    <div className="space-y-4">
      <AccountPageHeader
        icon={CalendarCheck}
        title="My Bookings"
        description="Track your requests, payments and trips"
        action={<SelectInput className="w-56" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { key: "pending", label: "Requested", value: summary?.requested, icon: Hourglass, tone: "text-amber-600 bg-amber-500/10" },
            { key: "confirmed", label: "Upcoming", value: summary?.upcoming, icon: CalendarClock, tone: "text-sky-600 bg-sky-500/10" },
            { key: "active", label: "On trip", value: summary?.active, icon: Car, tone: "text-violet-600 bg-violet-500/10" },
            { key: "completed", label: "Completed", value: summary?.completed, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-500/10" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setStatus(status === t.key ? "" : t.key); setPage(1); }}
              aria-pressed={status === t.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-background/70 p-3 text-left backdrop-blur transition-colors hover:border-primary/40",
                status === t.key && "border-primary ring-1 ring-primary",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", t.tone)}><t.icon className="h-4 w-4" /></span>
              <span>
                <span className="block text-lg font-semibold leading-tight tabular-nums">{t.value ?? "–"}</span>
                <span className="block text-xs text-muted-foreground">{t.label}</span>
              </span>
            </button>
          ))}
        </div>
        {summary?.to_pay_count > 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <Wallet className="h-4 w-4 shrink-0" />
            {format(summary.to_pay_amount)} still to pay on {summary.to_pay_count} booking{summary.to_pay_count > 1 ? "s" : ""} — open {summary.to_pay_count > 1 ? "them" : "it"} below to pay by transfer, or pay at pickup.
          </p>
        )}
      </AccountPageHeader>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !bookings.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10"><CalendarCheck className="h-7 w-7 text-primary" /></div>
          <p className="text-sm font-medium">No bookings yet</p>
          <Button asChild className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90"><Link href="/browse">Browse vehicles</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const hint = paymentHint(b, format);
            return (
            <Link key={b.id} href={`/account/bookings/${b.booking_reference}`} className="group block">
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
                    <Car className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{b.vehicle?.title}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{b.booking_reference} · {b.shop?.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(b.pickup_at)} → {formatDateTime(b.return_at)}</p>
                    {hint && <p className={`text-xs ${HINT_TONE[hint.tone]}`}>{hint.text}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="font-semibold">{format(b.pricing?.total_payable)}</p>
                    {b.payment_method === "bank_transfer" && <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><Landmark className="h-3 w-3" /> Bank transfer</p>}
                    {b.payment_method === "cash" && <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><Banknote className="h-3 w-3" /> Cash</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      )}

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {data.current_page} of {data.last_page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
