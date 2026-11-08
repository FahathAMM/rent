"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { notificationService } from "@/services/notificationService";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Vendor header by default (a notification belongs to the User model itself). The platform
 * console passes its own `service` and `queryKey`, plus `className` / `align` / `side` to fit its sidebar.
 */
export function NotificationBell({ service = notificationService, queryKey = "notifications", className, align = "end", side }) {
  const qc = useQueryClient();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: [queryKey],
    queryFn: () => service.getAll({ perPage: 8 }).then((r) => r.data),
    refetchInterval: 60000,
  });

  const markRead = useMutation({
    mutationFn: (id) => service.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => service.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const notifications = data?.record?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const handleClick = (n) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.data?.action_url) router.push(n.data.action_url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"} className={cn("relative h-[50px] w-[50px] shrink-0 rounded-xl border bg-card shadow-sm hover:bg-accent", className)}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-w-[calc(100vw-2rem)]" align={align} side={side} sideOffset={8}>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button type="button" onClick={() => markAllRead.mutate()} className="flex items-center gap-1 text-xs font-normal text-primary hover:underline">
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} onClick={() => handleClick(n)} className={cn("flex flex-col items-start gap-0.5 whitespace-normal py-2", !n.read_at && "bg-primary/5")}>
                <div className="flex w-full items-center gap-1.5">
                  {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className="text-sm font-medium">{n.data?.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{n.data?.body}</p>
                <p className="text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
