"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { bookingService } from "@/services/bookingService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { Loader2, CalendarCheck, ChevronRight, ChevronLeft } from "lucide-react";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">My Bookings</h1>
        <SelectInput className="w-56" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !bookings.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <div className="rounded-full bg-muted p-4"><CalendarCheck className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-sm font-medium">No bookings yet</p>
          <Button asChild variant="outline"><Link href="/search">Browse vehicles</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link key={b.id} href={`/account/bookings/${b.booking_reference}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{b.vehicle?.title}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{b.booking_reference} · {b.shop?.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(b.pickup_at)} → {formatDateTime(b.return_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-semibold">{format(b.pricing?.total_payable)}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
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
