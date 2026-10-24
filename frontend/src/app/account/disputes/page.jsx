"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { disputeService } from "@/services/disputeService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function DisputesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-disputes"],
    queryFn: () => disputeService.getAll().then((r) => r.data.record),
  });

  const disputes = data?.data ?? [];

  return (
    <div className="space-y-4">
      <AccountPageHeader icon={AlertTriangle} title="Disputes" description="Issues raised on your bookings" />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !disputes.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10"><AlertTriangle className="h-7 w-7 text-primary" /></div>
          <p className="text-sm font-medium">No disputes</p>
          <p className="max-w-sm text-sm text-muted-foreground">You can raise a dispute from a booking&apos;s detail page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <Link key={d.id} href={`/account/disputes/${d.dispute_reference}`} className="group block">
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{d.subject}</p>
                    <p className="text-xs text-muted-foreground">{d.dispute_reference} · {d.booking?.booking_reference} · {formatDateTime(d.created_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={d.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
