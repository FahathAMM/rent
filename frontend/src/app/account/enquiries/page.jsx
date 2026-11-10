"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Car, ChevronLeft, ChevronRight, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { inboxTime } from "@/lib/chat";

const TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

export default function AccountEnquiriesPage() {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-enquiries", tab, page],
    queryFn: () => customerService.enquiries.getAll({ page, status: tab === "all" ? undefined : tab }).then((r) => r.data.record),
    placeholderData: (previous) => previous,
    // Keeps the "new" badges current while the inbox is open.
    refetchInterval: 30000,
  });
  const enquiries = data?.data ?? [];

  const switchTab = (value) => { setTab(value); setPage(1); };

  return (
    <div className="space-y-4">
      <AccountPageHeader
        icon={MessageCircle}
        title="Enquiries"
        description="Your conversations with shops about vehicles for sale."
        action={<Button asChild variant="outline"><Link href="/buy">Vehicles for sale</Link></Button>}
      />

      <div className="inline-flex rounded-xl border bg-card p-1 shadow-sm" role="tablist" aria-label="Filter enquiries">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => switchTab(t.value)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Could not load your enquiries. Please try again.</div>
      ) : enquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center">
          <MessageCircle className="h-7 w-7 text-primary" />
          <p className="text-sm font-medium">{tab === "all" ? "No enquiries yet" : `No ${tab} enquiries`}</p>
          {tab === "all" && (
            <>
              <p className="max-w-sm text-sm text-muted-foreground">Open a vehicle for sale and ask the shop a question. The conversation will appear here.</p>
              <Button asChild variant="outline"><Link href="/buy">See vehicles for sale</Link></Button>
            </>
          )}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {enquiries.map((e) => <EnquiryRow key={e.id} enquiry={e} />)}
        </ul>
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

function EnquiryRow({ enquiry: e }) {
  const unread = e.unread_count > 0;
  const last = e.last_message;
  const preview = last ? `${last.sender_type === "customer" ? "You: " : ""}${last.body}` : "No messages yet";

  return (
    <li>
      <Link href={`/account/enquiries/${e.reference}`} className={cn("flex items-center gap-3 p-3 transition-colors hover:bg-muted/40 sm:p-4", unread && "bg-primary/5")}>
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border bg-muted">
          {e.vehicle?.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={e.vehicle.image_url} alt="" className="size-full object-cover" />
            : <div className="flex size-full items-center justify-center text-muted-foreground"><Car className="h-6 w-6" /></div>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{e.vehicle?.title ?? "Vehicle"}</p>
            <span className={cn("ml-auto shrink-0 text-xs", unread ? "font-semibold text-primary" : "text-muted-foreground")}>
              {inboxTime(last?.created_at ?? e.last_message_at)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{e.shop?.name ?? "Shop"}{e.shop?.city ? ` · ${e.shop.city}` : ""}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-medium text-foreground" : "text-muted-foreground")}>{preview}</p>
            {unread
              ? <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{e.unread_count}</span>
              : <StatusBadge status={e.status} className="shrink-0" />}
          </div>
        </div>
      </Link>
    </li>
  );
}
