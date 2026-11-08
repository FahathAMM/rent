"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ChevronLeft, ChevronRight, Loader2, MessageCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function AccountEnquiriesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-enquiries", page],
    queryFn: () => customerService.enquiries.getAll({ page }).then((r) => r.data.record),
  });
  const enquiries = data?.data ?? [];

  return (
    <div className="space-y-4">
      <AccountPageHeader
        icon={MessageCircle}
        title="Enquiries"
        description="Your conversations with shops about vehicles for sale."
        action={<Button asChild variant="outline"><Link href="/buy">Vehicles for sale</Link></Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Could not load your enquiries. Please try again.</div>
      ) : enquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center">
          <MessageCircle className="h-7 w-7 text-primary" />
          <p className="text-sm font-medium">No enquiries yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Open a vehicle for sale and ask the shop a question. The conversation will appear here.</p>
          <Button asChild variant="outline"><Link href="/buy">See vehicles for sale</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {enquiries.map((e) => (
            <Link key={e.id} href={`/account/enquiries/${e.reference}`} className="group block">
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{e.vehicle?.title ?? "Vehicle"}</p>
                    <StatusBadge status={e.status} />
                    {e.unread_count > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{e.unread_count} new</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{e.reference}{e.shop?.name ? ` · ${e.shop.name}` : ""}</p>
                  <p className="text-xs text-muted-foreground">Last message {formatDateTime(e.last_message_at)}</p>
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
