"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformReviewService } from "@/services/platformReviewService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { Star, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "hidden", label: "Hidden" },
];

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

export default function PlatformReviewsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [reasonAction, setReasonAction] = useState(null); // { id, action: 'reject'|'hide' }

  const { data, isLoading } = useQuery({
    queryKey: ["platform-reviews", status, page],
    queryFn: () => platformReviewService.getAll({ status: status || undefined, page }).then((r) => r.data.record),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-reviews"] });

  const publish = useMutation({
    mutationFn: (id) => platformReviewService.publish(id),
    onSuccess: () => { invalidate(); toast.success("Review published"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to publish"),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }) => platformReviewService.reject(id, reason),
    onSuccess: () => { invalidate(); toast.success("Review rejected"); setReasonAction(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reject"),
  });

  const hide = useMutation({
    mutationFn: ({ id, reason }) => platformReviewService.hide(id, reason),
    onSuccess: () => { invalidate(); toast.success("Review hidden"); setReasonAction(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to hide"),
  });

  const columns = [
    {
      key: "review", header: "Review",
      render: (row) => (
        <div className="max-w-xs">
          <div className="flex items-center gap-2">
            <Stars rating={row.rating} />
            <span className="text-xs text-muted-foreground">{row.user?.name}</span>
          </div>
          {row.title && <p className="text-sm font-medium">{row.title}</p>}
          {row.comment && <p className="truncate text-xs text-muted-foreground">{row.comment}</p>}
        </div>
      ),
    },
    { key: "vehicle", header: "Vehicle / Shop", render: (row) => <div><p className="text-sm">{row.vehicle?.title}</p><p className="text-xs text-muted-foreground">{row.shop?.name}</p></div> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "created_at", header: "Submitted", render: (row) => formatDateTime(row.created_at) },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.status === "pending" && (
            <>
              <Button size="sm" onClick={() => publish.mutate(row.id)} disabled={publish.isPending}>Publish</Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction({ id: row.id, action: "reject" })}>Reject</Button>
            </>
          )}
          {row.status === "published" && (
            <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction({ id: row.id, action: "hide" })}>Hide</Button>
          )}
        </div>
      ),
    },
  ];

  const records = data?.data ?? [];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Reviews" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Review Moderation" description="Approve new reviews before they go public, or hide a published one that was reported." />

        <div className="mb-4 w-56">
          <SelectInput label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />
        </div>

        <DataTable columns={columns} data={records} loading={isLoading} />

        {data && data.last_page > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {data.current_page} of {data.last_page} — {data.total} total</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </PageWrapper>

      <ReasonDialog
        open={reasonAction?.action === "reject"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Reject Review"
        description="This review will never be published."
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate({ id: reasonAction.id, reason })}
      />
      <ReasonDialog
        open={reasonAction?.action === "hide"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Hide Review"
        description="Takes this review off the public listing immediately."
        confirmText="Hide"
        loading={hide.isPending}
        onConfirm={(reason) => hide.mutate({ id: reasonAction.id, reason })}
      />
    </div>
  );
}
