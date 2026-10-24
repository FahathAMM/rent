"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformListingService } from "@/services/platformListingService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectInput } from "@/components/forms/SelectInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Home, ImageOff, Star } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const MODERATION_OPTIONS = [
  { value: "", label: "All moderation states" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "flagged", label: "Flagged" },
];

export default function PlatformListingsPage() {
  const qc = useQueryClient();
  const [moderationStatus, setModerationStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [reasonAction, setReasonAction] = useState(null); // 'reject' | 'flag' | 'unpublish'

  const { data, isLoading } = useQuery({
    queryKey: ["platform-listings", moderationStatus, search, page],
    queryFn: () => platformListingService.getAll({ moderation_status: moderationStatus || undefined, search: search || undefined, page }).then((r) => r.data.record),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["platform-listing", selected?.id],
    queryFn: () => platformListingService.getOne(selected.id).then((r) => r.data.data),
    enabled: !!selected,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-listings"] });
    qc.invalidateQueries({ queryKey: ["platform-listing", selected?.id] });
  };

  const approve = useMutation({
    mutationFn: () => platformListingService.approve(selected.id),
    onSuccess: () => { invalidate(); toast.success("Listing approved"); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to approve"),
  });

  const reject = useMutation({
    mutationFn: (reason) => platformListingService.reject(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Listing rejected"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reject"),
  });

  const flag = useMutation({
    mutationFn: (reason) => platformListingService.flag(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Listing flagged"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to flag"),
  });

  const unpublish = useMutation({
    mutationFn: (reason) => platformListingService.unpublish(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Listing unpublished"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to unpublish"),
  });

  const feature = useMutation({
    mutationFn: () => platformListingService.feature(selected.id),
    onSuccess: () => { invalidate(); toast.success("Listing featured"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const unfeature = useMutation({
    mutationFn: () => platformListingService.unfeature(selected.id),
    onSuccess: () => { invalidate(); toast.success("Listing unfeatured"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const primaryImageUrl = (img) => (img?.attachment ? `/storage/${img.attachment.file_path}` : null);

  const columns = [
    {
      key: "title", header: "Vehicle",
      render: (row) => {
        const img = (row.images ?? [])[0];
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={primaryImageUrl(img)} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">{row.title}</p>
              <p className="text-[11px] text-muted-foreground">{row.shop?.name}</p>
            </div>
          </div>
        );
      },
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "moderation_status", header: "Moderation", render: (row) => <StatusBadge status={row.moderation_status} /> },
    { key: "is_featured", header: "Featured", render: (row) => row.is_featured ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : "—" },
    { key: "created_at", header: "Submitted", render: (row) => formatDateTime(row.created_at) },
    {
      key: "actions", header: "Actions",
      render: (row) => <Button variant="outline" size="sm" onClick={() => setSelected(row)}>Review</Button>,
    },
  ];

  const records = data?.data ?? [];
  const canModerate = detail && ["pending", "flagged"].includes(detail.moderation_status);
  const canUnpublish = detail?.status === "published";
  const canFeature = detail?.status === "published" && !detail?.is_featured;
  const canUnfeature = detail?.is_featured;

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Listing Moderation" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Listing Moderation" description="Review new vehicle listings before they go live, and manage featured placement." />

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SelectInput
            label="Moderation"
            className="w-56"
            value={moderationStatus}
            onChange={(v) => { setModerationStatus(v); setPage(1); }}
            options={MODERATION_OPTIONS}
          />
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-sm font-medium">Search</label>
            <Input placeholder="Search by title..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <DataTable columns={columns} data={records} loading={isLoading} />

        {data && data.last_page > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {data.current_page} of {data.last_page} — {data.total} total</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </PageWrapper>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail?.title}
              {detail && <StatusBadge status={detail.status} />}
              {detail && <StatusBadge status={detail.moderation_status} />}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
          ) : (
            <div className="space-y-4">
              {(detail.images ?? []).length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {detail.images.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={img.id} src={primaryImageUrl(img)} alt="" className="aspect-video w-full rounded-md object-cover" />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Shop / Owner</p><p>{detail.shop?.name} ({detail.shop?.owner?.email})</p></div>
                <div><p className="text-muted-foreground">Make / Model</p><p>{detail.make} {detail.model} ({detail.year})</p></div>
                <div><p className="text-muted-foreground">Registration No.</p><p>{detail.registration_number}</p></div>
                <div><p className="text-muted-foreground">Category</p><p>{detail.category?.name ?? "—"}</p></div>
              </div>

              {detail.moderation_note && (
                <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{detail.moderation_note}</p>
              )}

              {(detail.moderation_history ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
                  <ul className="space-y-1.5 text-sm">
                    {detail.moderation_history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5">
                        <span className="capitalize">{h.action.replace(/_/g, " ")}{h.reason ? ` — ${h.reason}` : ""}</span>
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(h.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(canModerate || canUnpublish || canFeature || canUnfeature) && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {canModerate && (
                    <>
                      <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("reject")}>Reject</Button>
                      <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>
                    </>
                  )}
                  {canUnpublish && (
                    <>
                      <Button variant="outline" onClick={() => setReasonAction("flag")}>Flag</Button>
                      <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("unpublish")}>Unpublish</Button>
                    </>
                  )}
                  {canFeature && <Button variant="outline" onClick={() => feature.mutate()} disabled={feature.isPending}>Feature</Button>}
                  {canUnfeature && <Button variant="outline" onClick={() => unfeature.mutate()} disabled={unfeature.isPending}>Unfeature</Button>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={reasonAction === "reject"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Reject Listing"
        description="Shown to the owner so they know what to fix."
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "flag"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Flag Listing"
        description="Marks this listing for re-review without taking it offline."
        confirmText="Flag"
        loading={flag.isPending}
        onConfirm={(reason) => flag.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "unpublish"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Unpublish Listing"
        description="Takes this listing offline immediately."
        confirmText="Unpublish"
        loading={unpublish.isPending}
        onConfirm={(reason) => unpublish.mutate(reason)}
      />
    </div>
  );
}
