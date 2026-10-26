"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorBookingService } from "@/services/vendorBookingService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { InspectionDialog } from "@/components/vendor/InspectionDialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Home, Phone, Mail } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const ALL_STATUSES = "all";

const STATUS_OPTIONS = [
  { value: ALL_STATUSES, label: "All bookings" },
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [reasonAction, setReasonAction] = useState(null); // 'reject' | 'cancel'
  const [inspectionAction, setInspectionAction] = useState(null); // 'handover' | 'return'

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["vendor-booking", selected?.booking_reference],
    queryFn: () => vendorBookingService.getOne(selected.booking_reference).then((r) => r.data.data),
    enabled: !!selected,
  });

  const invalidate = () => {
    setRefreshKey((k) => k + 1);
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

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "booking_reference",
      header: () => <SortableHeader label="Booking" column="booking_reference" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.booking_reference}</p>
          <p className="text-[11px] text-muted-foreground">{row.vehicle?.title}</p>
        </div>
      ),
    },
    { accessorKey: "customer", header: "Customer", cell: (row) => row.customer?.name ?? "—" },
    {
      accessorKey: "pickup_at",
      header: () => <SortableHeader label="Pickup" column="pickup_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => formatDateTime(row.pickup_at),
    },
    {
      accessorKey: "status",
      header: () => <SortableHeader label="Status" column="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    { accessorKey: "total_payable", header: "Total", cell: (row) => format(row.pricing?.total_payable) },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => <Button variant="outline" size="sm" onClick={() => setSelected(row)}>Review</Button>,
    },
  ];

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
        <ServerDataTable
          key={refreshKey}
          endpoint="/vendor/bookings"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
          filters={{ status: status === ALL_STATUSES ? undefined : status }}
        >
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </ServerDataTable>
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
