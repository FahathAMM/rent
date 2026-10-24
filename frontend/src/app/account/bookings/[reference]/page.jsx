"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { bookingService } from "@/services/bookingService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Phone, MapPin } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const CANCELLABLE = ["pending", "accepted"];

export default function BookingDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [cancelling, setCancelling] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["my-booking", reference],
    queryFn: () => bookingService.getOne(reference).then((r) => r.data.data),
  });

  const cancel = useMutation({
    mutationFn: (reason) => bookingService.cancel(reference, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-booking", reference] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success("Booking cancelled");
      setCancelling(false);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not cancel booking"),
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-semibold">Booking not found</p>
        <Button asChild variant="outline"><Link href="/account/bookings">Back to bookings</Link></Button>
      </div>
    );
  }

  const canCancel = CANCELLABLE.includes(booking.status);
  const pricing = booking.pricing ?? {};

  return (
    <div className="space-y-4">
      <Link href="/account/bookings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to bookings
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{booking.vehicle?.title}</h1>
          <p className="text-sm text-muted-foreground">{booking.booking_reference}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {booking.status === "accepted" && (
        <Card className="border-amber-400/60"><CardContent className="py-4 text-sm text-amber-700">
          Your request was accepted — payment is coming in a future update. Hang tight.
        </CardContent></Card>
      )}
      {booking.status === "rejected" && booking.rejection_reason && (
        <Card className="border-destructive/40"><CardContent className="py-4 text-sm text-destructive">{booking.rejection_reason}</CardContent></Card>
      )}
      {booking.cancellation_reason && (
        <Card><CardContent className="py-4 text-sm text-muted-foreground">Cancellation note: {booking.cancellation_reason}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Rental Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><p className="text-muted-foreground">Pickup</p><p className="font-medium">{formatDateTime(booking.pickup_at)}</p></div>
          <div><p className="text-muted-foreground">Return</p><p className="font-medium">{formatDateTime(booking.return_at)}</p></div>
          <div><p className="text-muted-foreground">Duration</p><p className="font-medium">{booking.rental_days} day(s)</p></div>
          <div><p className="text-muted-foreground">Vehicle Reg. No.</p><p className="font-medium">{booking.vehicle?.registration_number}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Shop Contact</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{booking.shop?.name}</p>
          {booking.shop?.phone && <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {booking.shop.phone}</p>}
          {booking.pickup_location && <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {booking.pickup_location.name}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Price Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Base rental</span><span>{format(pricing.base_amount)}</span></div>
          {Number(pricing.driver_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Driver</span><span>{format(pricing.driver_amount)}</span></div>}
          {Number(pricing.delivery_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{format(pricing.delivery_amount)}</span></div>}
          {Number(pricing.tax_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{format(pricing.tax_amount)}</span></div>}
          {Number(pricing.security_deposit) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Security deposit</span><span>{format(pricing.security_deposit)}</span></div>}
          <div className="flex justify-between border-t pt-1.5 font-semibold"><span>Total payable</span><span>{format(pricing.total_payable)}</span></div>
        </CardContent>
      </Card>

      {booking.customer_note && (
        <Card><CardHeader><CardTitle className="text-base">Your Note</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{booking.customer_note}</CardContent></Card>
      )}

      {canCancel && (
        <div className="flex justify-end">
          <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setCancelling(true)}>
            Cancel Booking
          </Button>
        </div>
      )}

      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancel Booking"
        description="Nothing has been charged yet — this cancels your request entirely."
        confirmText="Cancel Booking"
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />
    </div>
  );
}
