"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight, ArrowUpRight, CalendarCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const CATEGORY_LABELS = {
  damage: "Damage", no_show: "No show", overcharge: "Overcharge", vehicle_condition: "Vehicle condition",
  refund: "Refund", late_return: "Late return", fraud: "Fraud", other: "Other",
};

export default function AccountDisputesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-disputes", page],
    queryFn: () => customerService.disputes.getAll({ page }).then((r) => r.data.record),
  });
  const disputes = data?.data ?? [];

  return (
    <div className="space-y-4">
      <AccountPageHeader
        icon={AlertTriangle}
        title="Disputes"
        description="Follow issues raised about your rentals and reply to the platform team or shop."
        action={<Button asChild variant="outline"><Link href="/account/bookings"><CalendarCheck className="mr-2 h-4 w-4" />My bookings</Link></Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Could not load your disputes. Please try again.</div>
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10"><AlertTriangle className="h-7 w-7 text-primary" /></div>
          <p className="text-sm font-medium">No disputes</p>
          <p className="max-w-sm text-sm text-muted-foreground">If an issue comes up with a confirmed rental, open that booking to contact the shop through a dispute.</p>
          <Button asChild variant="outline"><Link href="/account/bookings">View bookings</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <Link key={d.id} href={`/account/disputes/${d.dispute_reference}`} className="group block">
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{d.subject}</p><StatusBadge status={d.status} /></div>
                  <p className="text-sm text-muted-foreground">{d.dispute_reference} · Booking {d.booking?.booking_reference}{d.booking?.shop?.name ? ` · ${d.booking.shop.name}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[d.category] ?? d.category} · Opened {formatDateTime(d.created_at)}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {data.current_page} of {data.last_page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
