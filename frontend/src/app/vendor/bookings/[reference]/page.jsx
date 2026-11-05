"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { InspectionDialog } from "../components/InspectionDialog";
import { VendorBookingDetail } from "../components/VendorBookingDetail";
import { RescheduleDialog } from "../components/RescheduleDialog";
import { Button } from "@/components/ui/button";
import { PdfMenu } from "@/components/shared/PdfMenu";
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  FileText,
  Home,
  KeyRound,
  Loader2,
  RotateCcw,
  XCircle,
  ScrollText,
} from "lucide-react";
import { downloadBlob } from "@/lib/utils";
import { toast } from "sonner";

export default function VendorBookingDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const [reasonAction, setReasonAction] = useState(null); // 'reject' | 'cancel'
  const [inspectionAction, setInspectionAction] = useState(null); // 'handover' | 'return'
  const [pdfBusy, setPdfBusy] = useState(null); // 'voucher' | 'agreement' while the PDF loads
  const [rescheduling, setRescheduling] = useState(false);

  // Voucher or agreement PDF: view opens /documents/... in a new tab (it loads the PDF itself);
  // download saves it as "<booking no>.pdf".
  const openPdf = (kind, download) => {
    if (!download) {
      window.open(`/documents/vendor/${reference}/${kind}`, "_blank");
      return;
    }
    setPdfBusy(kind);
    vendorService.bookings[kind](reference, true)
      .then((res) => downloadBlob(res.data, `${reference}.pdf`))
      .catch(() => {
        toast.error(
          kind === "voucher"
            ? "Could not load the booking voucher"
            : "Could not load the rental agreement",
        );
      })
      .finally(() => setPdfBusy(null));
  };

  const { data: booking, isLoading } = useQuery({
    queryKey: ["vendor-booking", reference],
    queryFn: () =>
      vendorService.bookings.getOne(reference).then((r) => r.data.data),
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["vendor-booking", reference] });
  const onError = (fallback) => (err) =>
    toast.error(err.response?.data?.message ?? fallback);

  const accept = useMutation({
    mutationFn: () => vendorService.bookings.accept(reference),
    onSuccess: (res) => {
      refresh();
      toast.success(
        res.data.data?.payment_method === "cash"
          ? "Booking confirmed — the customer pays you in cash at pickup"
          : "Booking accepted — awaiting customer payment",
      );
    },
    onError: onError("Failed to accept"),
  });
  const reject = useMutation({
    mutationFn: (reason) => vendorService.bookings.reject(reference, reason),
    onSuccess: () => {
      refresh();
      setReasonAction(null);
      toast.success("Booking rejected");
    },
    onError: onError("Failed to reject"),
  });
  const cancel = useMutation({
    mutationFn: (reason) => vendorService.bookings.cancel(reference, reason),
    onSuccess: () => {
      refresh();
      setReasonAction(null);
      toast.success("Booking cancelled");
    },
    onError: onError("Failed to cancel"),
  });
  const handover = useMutation({
    mutationFn: (inspection) =>
      vendorService.bookings.handover(reference, inspection),
    onSuccess: () => {
      refresh();
      setInspectionAction(null);
      toast.success("Handover recorded — booking is now active");
    },
  });
  const returnVehicle = useMutation({
    mutationFn: (inspection) =>
      vendorService.bookings.returnVehicle(reference, inspection),
    onSuccess: () => {
      refresh();
      setInspectionAction(null);
      toast.success("Return recorded — booking completed");
    },
  });

  const submitInspection = (payload, setErrors) => {
    const mutation = inspectionAction === "handover" ? handover : returnVehicle;
    mutation.mutate(payload, {
      onError: (err) => {
        const apiErrors = err.response?.data?.errors ?? {};
        setErrors(apiErrors);
        if (!Object.keys(apiErrors).length)
          toast.error(
            err.response?.data?.message ?? "Failed to save inspection",
          );
      },
    });
  };

  const breadcrumbItems = [
    {
      label: "Home",
      href: "/vendor/dashboard",
      icon: <Home className="size-4" />,
    },
    { label: "Bookings", href: "/vendor/bookings" },
    { label: reference },
  ];

  const status = booking?.status;
  const deposit = booking?.security_deposit;
  const cashDeposit = deposit?.hold_method === "cash_on_pickup";
  const isBank = booking?.payment_method === "bank_transfer";
  const paidToShop = booking?.payment_method === "cash" || isBank;
  // Cash due at handover: paid-to-shop → whatever the shop hasn't verified yet (deposit included); online → just a cash-on-pickup deposit.
  const cashDue = paidToShop
    ? Number(booking.balance_due ?? booking.pricing?.total_payable ?? 0)
    : cashDeposit && deposit.status === "pending"
      ? Number(deposit.amount_required)
      : null;
  const depositHeld =
    cashDeposit && deposit.status === "held"
      ? Number(deposit.amount_collected)
      : null;
  const danger =
    "gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10";
  const actions = booking && (
    <>
      {status === "pending" && (
        <>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => accept.mutate()}
            disabled={accept.isPending}
          >
            {accept.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}{" "}
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={danger}
            onClick={() => setReasonAction("reject")}
          >
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
        </>
      )}
      {/* Before handover — any refund of what the customer already paid follows the shop's policy. */}
      {status === "confirmed" && (
        <Button
          size="sm"
          variant="outline"
          className={danger}
          onClick={() => setReasonAction("cancel")}
        >
          <Ban className="h-3.5 w-3.5" /> Cancel booking
        </Button>
      )}
      {status === "confirmed" && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setRescheduling(true)}
        >
          <CalendarClock className="h-3.5 w-3.5" /> Change dates
        </Button>
      )}
      {status === "confirmed" && (
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setInspectionAction("handover")}
        >
          <KeyRound className="h-3.5 w-3.5" /> Record handover
        </Button>
      )}
      {status === "active" && (
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setInspectionAction("return")}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Record return
        </Button>
      )}
      {["confirmed", "active", "completed"].includes(status) && (
        <>
          <PdfMenu
            label="Voucher"
            icon={FileText}
            loading={pdfBusy === "voucher"}
            onView={() => openPdf("voucher", false)}
            onDownload={() => openPdf("voucher", true)}
          />
          <PdfMenu
            label={`Agreement${booking?.agreement?.signed ? " ✓" : ""}`}
            icon={ScrollText}
            title={
              booking?.agreement?.signed
                ? "Signed by the customer at handover"
                : "Not signed yet"
            }
            loading={pdfBusy === "agreement"}
            onView={() => openPdf("agreement", false)}
            onDownload={() => openPdf("agreement", true)}
          />
        </>
      )}
    </>
  );

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        {isLoading || !booking ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <VendorBookingDetail
            booking={booking}
            actions={actions}
            canEdit
            onChanged={refresh}
          />
        )}
      </PageWrapper>

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
        description={
          Number(booking?.amount_paid) > 0
            ? `The vehicle becomes available again immediately. The customer has paid you ${booking.amount_paid} — refund them as your policy says.`
            : "The vehicle becomes available again immediately."
        }
        confirmText="Cancel Booking"
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />

      {rescheduling && booking && (
        <RescheduleDialog
          booking={booking}
          onClose={() => setRescheduling(false)}
          onSaved={() => {
            setRescheduling(false);
            refresh();
          }}
        />
      )}
      <InspectionDialog
        open={inspectionAction === "handover"}
        onOpenChange={(v) => !v && setInspectionAction(null)}
        title="Record Handover"
        terms={booking?.agreement?.signed ? null : booking?.agreement?.terms}
        allowDamages={false}
        cashDue={cashDue}
        onSubmit={submitInspection}
        loading={handover.isPending}
      />
      <InspectionDialog
        open={inspectionAction === "return"}
        onOpenChange={(v) => !v && setInspectionAction(null)}
        title="Record Return"
        allowDamages
        depositHeld={depositHeld}
        onSubmit={submitInspection}
        loading={returnVehicle.isPending}
      />
    </div>
  );
}
