"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorReviewService } from "@/services/vendorReviewService";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextareaInput } from "@/components/forms/FormField";
import { Loader2, Star, Home, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function ReplyBox({ review }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const reply = useMutation({
    mutationFn: () => vendorReviewService.reply(review.id, draft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-reviews"] }); toast.success("Reply posted"); setDraft(""); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reply"),
  });

  if (review.owner_reply) {
    return (
      <div className="mt-2 rounded-md bg-muted p-2.5 text-sm">
        <p className="text-xs font-semibold text-muted-foreground">Your reply</p>
        <p>{review.owner_reply}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <TextareaInput className="flex-1" placeholder="Reply to this review..." value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Button size="sm" onClick={() => reply.mutate()} disabled={!draft.trim() || reply.isPending}>
        {reply.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reply"}
      </Button>
    </div>
  );
}

export default function VendorReviewsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-reviews", page],
    queryFn: () => vendorReviewService.getAll({ page }).then((r) => r.data.record),
  });

  const reviews = data?.data ?? [];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Reviews" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !reviews.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <div className="rounded-full bg-muted p-4"><Star className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-sm font-medium">No published reviews yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{r.vehicle?.title}</p>
                  </div>
                  <Stars rating={r.rating} />
                </div>
                {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(r.created_at)}</p>
                <ReplyBox review={r} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {data.current_page} of {data.last_page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </HomePageWrapper>
  );
}
