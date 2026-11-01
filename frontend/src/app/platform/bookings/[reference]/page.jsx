"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { BookingDetail } from "../components/BookingDetail";
import { Button } from "@/components/ui/button";
import { Ban, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CANCELLABLE = ["pending", "confirmed", "active"];

export default function PlatformBookingDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["platform-booking", reference],
    queryFn: () => platformService.bookings.getOne(reference).then((r) => r.data.data),
  });

  const cancel = useMutation({
    mutationFn: (reason) => platformService.bookings.cancel(reference, reason),
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

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      {isLoading || !booking ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <BookingDetail
          booking={booking}
          actions={CANCELLABLE.includes(booking.status) && (
            <Button variant="outline" size="sm" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setCancelling(true)}>
              <Ban className="h-3.5 w-3.5" /> Cancel booking
            </Button>
          )}
        />
      )}

      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancel Booking"
        description="Platform override. The customer paid the shop directly, so any refund is between the shop and the customer."
        confirmText="Cancel Booking"
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />
    </PageWrapper>
  );
}
