"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformBookingService } from "@/services/platformBookingService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Home, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const CANCELLABLE = ["pending", "accepted", "confirmed", "active"];

export default function PlatformBookingDetailPage() {
  const { reference } = useParams();
  const { format } = useCurrencyFormat();
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["platform-booking", reference],
    queryFn: () => platformBookingService.getOne(reference).then((r) => r.data.data),
  });

  const cancel = useMutation({
    mutationFn: (reason) => platformBookingService.cancel(reference, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-booking", reference] });
      toast.success("Booking cancelled");
      setCancelling(false);
    },
    onError: (err) => toast.error(err.response?.data?.errors?.status?.[0] ?? err.response?.data?.message ?? "Failed to cancel"),
  });

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Bookings", href: "/platform/bookings" },
    { label: reference },
  ];

  if (isLoading || !booking) {
    return (
      <PageWrapper breadcrumb={breadcrumbItems}>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </PageWrapper>
    );
  }

  const canCancel = CANCELLABLE.includes(booking.status);
  const pricing = booking.pricing ?? {};
  const financials = booking.financials ?? {};

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title={booking.vehicle?.title}
        description={`${booking.booking_reference} · ${booking.shop?.name} · ${booking.customer?.name}`}
        action={canCancel && (
          <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setCancelling(true)}>
            Cancel Booking
          </Button>
        )}
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={booking.status} />
        {booking.has_open_dispute && <StatusBadge status="flagged" />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Rental Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">Pickup</p><p className="font-medium">{formatDateTime(booking.pickup_at)}</p></div>
            <div><p className="text-muted-foreground">Return</p><p className="font-medium">{formatDateTime(booking.return_at)}</p></div>
            <div><p className="text-muted-foreground">Rental days</p><p className="font-medium">{booking.rental_days}</p></div>
            <div><p className="text-muted-foreground">Payment status</p><p className="font-medium capitalize">{booking.payment_status}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Price & Settlement</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">Total payable</p><p className="font-medium">{format(pricing.total_payable)}</p></div>
            <div><p className="text-muted-foreground">Commission</p><p className="font-medium">{financials.commission_amount != null ? format(financials.commission_amount) : "—"}</p></div>
            <div><p className="text-muted-foreground">Owner payable</p><p className="font-medium">{financials.owner_payable_amount != null ? format(financials.owner_payable_amount) : "—"}</p></div>
            <div><p className="text-muted-foreground">Settlement status</p><p className="font-medium capitalize">{financials.settlement_status?.replace("_", " ") ?? "—"}</p></div>
          </CardContent>
        </Card>
      </div>

      {booking.disputes?.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Disputes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {booking.disputes.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span>{d.subject}</span>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {booking.status_histories?.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {booking.status_histories.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-muted-foreground">
                <span>{h.from_value ?? "—"} → <span className="font-medium text-foreground">{h.to_value}</span> ({h.actor_type})</span>
                <span className="text-xs">{formatDateTime(h.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancel Booking"
        description="Platform override — does not trigger a refund. Record one separately on the Refunds page if money needs to move."
        confirmText="Cancel Booking"
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />
    </PageWrapper>
  );
}
