"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { vendorReviewService } from "@/services/vendorReviewService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TextareaInput } from "@/components/forms/FormField";
import { Loader2, Star, MessageSquareReply, Home } from "lucide-react";
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

export default function VendorReviewsPage() {
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const reply = useMutation({
    mutationFn: () => vendorReviewService.reply(selected.id, draft),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Reply posted"); setSelected(null); setDraft(""); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reply"),
  });

  const openReview = (review) => { setSelected(review); setDraft(""); };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    { accessorKey: "user", header: "Customer", cell: (row) => row.user?.name ?? "—" },
    { accessorKey: "vehicle", header: "Vehicle", cell: (row) => row.vehicle?.title ?? "—" },
    {
      accessorKey: "rating",
      header: () => <SortableHeader label="Rating" column="rating" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <Stars rating={row.rating} />,
    },
    { accessorKey: "comment", header: "Comment", cell: (row) => <span className="line-clamp-1">{row.comment ?? "—"}</span> },
    {
      accessorKey: "created_at",
      header: () => <SortableHeader label="Date" column="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => formatDateTime(row.created_at),
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => row.owner_reply ? (
        <span className="text-xs font-medium text-emerald-600">Replied</span>
      ) : (
        <ActionButton onClick={() => openReview(row)} icon={MessageSquareReply} label="Reply" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Reviews" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/vendor/reviews"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
        />
      </HomePageWrapper>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2">{selected?.user?.name}<Stars rating={selected?.rating ?? 0} /></DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{selected.vehicle?.title} · {formatDateTime(selected.created_at)}</p>
              {selected.comment && <p className="rounded-md bg-muted p-2.5 text-sm">{selected.comment}</p>}
              <TextareaInput label="Your reply" placeholder="Reply to this review..." value={draft} onChange={(e) => setDraft(e.target.value)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                <Button onClick={() => reply.mutate()} disabled={!draft.trim() || reply.isPending}>
                  {reply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Post Reply
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
