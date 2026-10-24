"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { disputeService } from "@/services/disputeService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function DisputesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-disputes"],
    queryFn: () => disputeService.getAll().then((r) => r.data.record),
  });

  const disputes = data?.data ?? [];

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Disputes</h1>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !disputes.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <div className="rounded-full bg-muted p-4"><AlertTriangle className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-sm font-medium">No disputes</p>
          <p className="max-w-sm text-sm text-muted-foreground">You can raise a dispute from a booking&apos;s detail page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <Link key={d.id} href={`/account/disputes/${d.dispute_reference}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-2 py-4">
                  <div>
                    <p className="font-semibold">{d.subject}</p>
                    <p className="text-xs text-muted-foreground">{d.dispute_reference} · {d.booking?.booking_reference} · {formatDateTime(d.created_at)}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
