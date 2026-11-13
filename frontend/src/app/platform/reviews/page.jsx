"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Star, Home, Check, X, EyeOff } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { ActionButton } from "@/components/Datatable/ActionButton";

const STATUS_OPTIONS = [
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
  const [status, setStatus] = useState("");
  const [reasonAction, setReasonAction] = useState(null); // { id, action: 'reject'|'hide' }
  const [refreshKey, setRefreshKey] = useState(0);

  const invalidate = () => setRefreshKey((k) => k + 1);

  const publish = useMutation({
    mutationFn: (id) => platformService.reviews.publish(id),
    onSuccess: () => { invalidate(); toast.success("Review published"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to publish"),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }) => platformService.reviews.reject(id, reason),
    onSuccess: () => { invalidate(); toast.success("Review rejected"); setReasonAction(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reject"),
  });

  const hide = useMutation({
    mutationFn: ({ id, reason }) => platformService.reviews.hide(id, reason),
    onSuccess: () => { invalidate(); toast.success("Review hidden"); setReasonAction(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to hide"),
  });

  const columns = () => [
    {
      accessorKey: "review", header: "Review", style: { width: "34%" },
      cell: (row) => (
        <div className="py-1">
          <div className="flex items-center gap-2">
            <Stars rating={row.rating} />
            <span className="truncate text-[10px] text-muted-foreground">{row.user?.name}</span>
          </div>
          {row.title && <p className="truncate font-medium">{row.title}</p>}
          {row.comment && <p className="truncate text-[10px] text-muted-foreground">{row.comment}</p>}
        </div>
      ),
    },
    { accessorKey: "vehicle", header: "Vehicle / Shop", cell: (row) => <div className="min-w-0"><p className="truncate">{row.vehicle?.title}</p><p className="truncate text-[10px] text-muted-foreground">{row.shop?.name}</p></div> },
    { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { accessorKey: "created_at", header: "Submitted", cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span> },
    {
      accessorKey: "actions", header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {row.status === "pending" && (
            <>
              <ActionButton onClick={() => publish.mutate(row.id)} icon={Check} label="Publish" className="text-emerald-600 border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400" disabled={publish.isPending} />
              <ActionButton onClick={() => setReasonAction({ id: row.id, action: "reject" })} icon={X} label="Reject" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
            </>
          )}
          {row.status === "published" && (
            <ActionButton onClick={() => setReasonAction({ id: row.id, action: "hide" })} icon={EyeOff} label="Hide" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Reviews" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          api={platformApi}
          endpoint="/platform/reviews"
          columns={columns}
          breadcrumb={[]}
          searchable={false}
          filters={{ status: status || undefined }}
        >
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
        </ServerDataTable>
      </HomePageWrapper>

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
