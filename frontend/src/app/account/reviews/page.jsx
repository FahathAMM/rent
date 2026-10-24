"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { reviewService } from "@/services/reviewService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { Button } from "@/components/ui/button";
import { Loader2, Star } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

export default function AccountReviewsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => reviewService.getAll().then((r) => r.data.record),
  });

  const reviews = data?.data ?? [];

  return (
    <div className="space-y-4">
      <AccountPageHeader icon={Star} title="My Reviews" description="What you've shared about your rentals" />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !reviews.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10"><Star className="h-7 w-7 text-primary" /></div>
          <p className="text-sm font-medium">No reviews yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Complete a rental to leave your first review.</p>
          <Button asChild variant="outline"><Link href="/account/bookings">View bookings</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.vehicle?.title}</p>
                  <Stars rating={r.rating} />
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              {r.moderation_reason && r.status === "rejected" && (
                <p className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">Rejected: {r.moderation_reason}</p>
              )}
              {r.owner_reply && (
                <div className="mt-2 rounded-md bg-muted p-2.5 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">Owner&apos;s reply</p>
                  <p>{r.owner_reply}</p>
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">{formatDateTime(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
