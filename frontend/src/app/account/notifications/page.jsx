"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

/** Updates about the customer's bookings, payments and enquiries. Opening one marks it read and goes to what it's about. */
export default function AccountNotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-notifications", page],
    queryFn: () => customerService.notifications.getAll({ page }).then((r) => r.data),
  });
  const list = data?.record?.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-notifications"] });

  const readAll = useMutation({ mutationFn: customerService.notifications.markAllRead, onSuccess: refresh });

  const open = async (n) => {
    if (!n.read_at) {
      await customerService.notifications.markRead(n.id).catch(() => {});
      refresh();
    }
    if (n.data?.action_url) router.push(n.data.action_url);
  };

  return (
    <div className="space-y-4">
      <AccountPageHeader
        icon={Bell}
        title="Notifications"
        description="Updates about your bookings, payments and enquiries."
        action={data?.unread_count > 0 && (
          <Button variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending}><CheckCheck className="mr-2 h-4 w-4" />Mark all read</Button>
        )}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Could not load your notifications. Please try again.</div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center">
          <Bell className="h-7 w-7 text-primary" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Updates about your bookings and enquiries will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => open(n)}
              className={cn("flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40", !n.read_at && "border-primary/30 bg-primary/5")}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{n.data?.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{n.data?.body}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {data?.record?.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {data.record.current_page} of {data.record.last_page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.record.last_page} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
