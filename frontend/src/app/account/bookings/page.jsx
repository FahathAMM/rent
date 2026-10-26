"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { bookingService } from "@/services/bookingService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { Loader2, CalendarCheck, ChevronRight, ChevronLeft, Car } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All bookings" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted — awaiting payment" },
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

  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings", status, page],
    queryFn: () => bookingService.getAll({ status: status || undefined, page }).then((r) => r.data.record),
  });

  const bookings = data?.data ?? [];

  return (
    <div className="space-y-4">
      <AccountPageHeader
        icon={CalendarCheck}
        title="My Bookings"
        description="Track your requests, payments and trips"
        action={<SelectInput className="w-56" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />}
      />

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
          {bookings.map((b) => (
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
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="font-semibold">{format(b.pricing?.total_payable)}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
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
