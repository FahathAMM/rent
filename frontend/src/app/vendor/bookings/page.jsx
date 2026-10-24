"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorBookingService } from "@/services/vendorBookingService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { InspectionDialog } from "@/components/vendor/InspectionDialog";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Home, Phone, Mail } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All bookings" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted — awaiting payment" },
  { value: "confirmed", label: "Confirmed" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "cancelled_by_customer", label: "Cancelled by customer" },
  { value: "cancelled_by_owner", label: "Cancelled by me" },
  { value: "no_show", label: "No-show" },
];

export default function VendorBookingsPage() {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [reasonAction, setReasonAction] = useState(null); // 'reject' | 'cancel'
  const [inspectionAction, setInspectionAction] = useState(null); // 'handover' | 'return'

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-bookings", status, page],
    queryFn: () => vendorBookingService.getAll({ status: status || undefined, page }).then((r) => r.data.record),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["vendor-booking", selected?.booking_reference],
    queryFn: () => vendorBookingService.getOne(selected.booking_reference).then((r) => r.data.data),
    enabled: !!selected,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vendor-bookings"] });
    qc.invalidateQueries({ queryKey: ["vendor-booking", selected?.booking_reference] });
  };

  const accept = useMutation({
    mutationFn: () => vendorBookingService.accept(selected.booking_reference),
    onSuccess: () => { invalidate(); toast.success("Booking accepted — awaiting customer payment"); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to accept"),
  });

  const reject = useMutation({
    mutationFn: (reason) => vendorBookingService.reject(selected.booking_reference, reason),
    onSuccess: () => { invalidate(); toast.success("Booking rejected"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reject"),
  });

  const cancel = useMutation({
    mutationFn: (reason) => vendorBookingService.cancel(selected.booking_reference, reason),
    onSuccess: () => { invalidate(); toast.success("Booking cancelled"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to cancel"),
  });

  const handover = useMutation({
    mutationFn: (inspection) => vendorBookingService.handover(selected.booking_reference, inspection),
    onSuccess: () => { invalidate(); toast.success("Handover recorded — booking is now active"); setInspectionAction(null); setSelected(null); },
  });

  const returnVehicle = useMutation({
    mutationFn: (inspection) => vendorBookingService.returnVehicle(selected.booking_reference, inspection),
    onSuccess: () => { invalidate(); toast.success("Return recorded — booking completed"); setInspectionAction(null); setSelected(null); },
  });

  const submitInspection = (payload, setErrors) => {
    const mutation = inspectionAction === "handover" ? handover : returnVehicle;
    mutation.mutate(payload, {
      onError: (err) => {
        const apiErrors = err.response?.data?.errors ?? {};
        setErrors(apiErrors);
        if (!Object.keys(apiErrors).length) toast.error(err.response?.data?.message ?? "Failed to save inspection");
      },
    });
  };

  const columns = [
    {
      key: "booking_reference", header: "Booking",
      render: (row) => (
        <div>
          <p className="font-medium">{row.booking_reference}</p>
          <p className="text-[11px] text-muted-foreground">{row.vehicle?.title}</p>
        </div>
      ),
    },
    { key: "customer", header: "Customer", render: (row) => row.customer?.name ?? "—" },
    { key: "pickup_at", header: "Pickup", render: (row) => formatDateTime(row.pickup_at) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "total_payable", header: "Total", render: (row) => format(row.pricing?.total_payable) },
    {
      key: "actions", header: "Actions",
      render: (row) => <Button variant="outline" size="sm" onClick={() => setSelected(row)}>Review</Button>,
    },
  ];

  const records = data?.data ?? [];
  const canRespond = detail?.status === "pending";
  const canCancel = detail?.status === "accepted";
  const canHandover = detail?.status === "confirmed";
  const canReturnVehicle = detail?.status === "active";

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Bookings" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Bookings" description="Respond to booking requests for your vehicles." />

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
      </HomePageWrapper>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail?.booking_reference}
              {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Vehicle</p><p>{detail.vehicle?.title}</p></div>
                <div><p className="text-muted-foreground">Reg. No.</p><p>{detail.vehicle?.registration_number}</p></div>
                <div><p className="text-muted-foreground">Pickup</p><p>{formatDateTime(detail.pickup_at)}</p></div>
                <div><p className="text-muted-foreground">Return</p><p>{formatDateTime(detail.return_at)}</p></div>
                <div><p className="text-muted-foreground">Duration</p><p>{detail.rental_days} day(s)</p></div>
                <div><p className="text-muted-foreground">Total payable</p><p className="font-semibold">{format(detail.pricing?.total_payable)}</p></div>
              </div>

              <div className="rounded-lg border p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
                <p className="font-medium">{detail.customer?.name}</p>
                {detail.customer?.phone && <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {detail.customer.phone}</p>}
                {detail.customer?.email && <p className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {detail.customer.email}</p>}
              </div>

              {detail.customer_note && (
                <p className="rounded-md bg-muted p-2.5 text-sm"><span className="text-muted-foreground">Note: </span>{detail.customer_note}</p>
              )}

              {(canRespond || canCancel || canHandover || canReturnVehicle) && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {canRespond && (
                    <>
                      <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("reject")}>Reject</Button>
                      <Button onClick={() => accept.mutate()} disabled={accept.isPending}>Accept</Button>
                    </>
                  )}
                  {canCancel && (
                    <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("cancel")}>Cancel Booking</Button>
                  )}
                  {canHandover && (
                    <Button onClick={() => setInspectionAction("handover")}>Record Handover</Button>
                  )}
                  {canReturnVehicle && (
                    <Button onClick={() => setInspectionAction("return")}>Record Return</Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={reasonAction === "reject"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Reject Booking Request"
        description="Shown to the customer so they understand why."
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "cancel"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Cancel Booking"
        description="The vehicle becomes available again immediately."
        confirmText="Cancel Booking"
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />

      <InspectionDialog
        open={inspectionAction === "handover"}
        onOpenChange={(v) => !v && setInspectionAction(null)}
        title="Record Handover"
        allowDamages={false}
        onSubmit={submitInspection}
        loading={handover.isPending}
      />
      <InspectionDialog
        open={inspectionAction === "return"}
        onOpenChange={(v) => !v && setInspectionAction(null)}
        title="Record Return"
        allowDamages
        onSubmit={submitInspection}
        loading={returnVehicle.isPending}
      />
    </div>
  );
}
