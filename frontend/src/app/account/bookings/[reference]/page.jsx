"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { customerService } from "@/services/customerService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatusBanner } from "@/components/shared/StatusBanner";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { WriteReviewDialog } from "@/components/account/WriteReviewDialog";
import { BankTransferCard } from "@/components/account/BankTransferCard";
import { CustomerPaymentsList } from "@/components/account/CustomerPaymentsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PdfMenu } from "@/components/shared/PdfMenu";
import {
  ArrowLeft, Loader2, Phone, MapPin, Star, AlertTriangle, FileText, Car, CalendarRange, CalendarClock, Receipt, XCircle, Ban, Banknote, Landmark, ScrollText, Clock, Wallet,
} from "lucide-react";
import { downloadBlob, formatDateTime } from "@/lib/utils";
import { isMoneyLine } from "@/lib/statement";
import { toast } from "sonner";

const CANCELLABLE = ["pending"];

function SectionHeader({ icon: Icon, title }) {
  return (
    <CardHeader className="flex-row items-center gap-3 space-y-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
  );
}

export default function BookingDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [cancelling, setCancelling] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(null); // "voucher" | "agreement" while the PDF is being fetched

  const { data: booking, isLoading } = useQuery({
    queryKey: ["my-booking", reference],
    queryFn: () => customerService.bookings.getOne(reference).then((r) => r.data.data),
  });

  const cancel = useMutation({
    mutationFn: (reason) => customerService.bookings.cancel(reference, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-booking", reference] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success("Booking cancelled");
      setCancelling(false);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not cancel booking"),
  });

  const submitReview = useMutation({
    mutationFn: (data) => customerService.reviews.create({ booking_reference: reference, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-booking", reference] });
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      toast.success("Review submitted — it will appear once moderated");
      setReviewing(false);
    },
  });

  const handleReviewSubmit = (data, setErrors) => {
    submitReview.mutate(data, { onError: (err) => setErrors(err.response?.data?.errors ?? {}) });
  };

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

  const isCash = booking.payment_method === "cash";
  const isBank = booking.payment_method === "bank_transfer";
  const paidToShop = isCash || isBank;
  // Money already sent (or waiting to be checked) → refunds follow the shop's policy, so the customer contacts the shop.
  const sentMoney = (booking.payments ?? []).some((p) => isMoneyLine(p) && ["pending", "succeeded"].includes(p.status));
  const canCancel = CANCELLABLE.includes(booking.status)
    || (paidToShop && booking.status === "confirmed" && booking.payment_status === "unpaid" && !sentMoney);
  const mustContactShop = paidToShop && booking.status === "confirmed" && !canCancel;
  const policies = booking.shop?.policies ?? [];
  const canReview = booking.status === "completed" && !booking.review
    && (!booking.review_eligible_until || new Date(booking.review_eligible_until) > new Date());
  const pricing = booking.pricing ?? {};
  // Shop date changes, newest first: show the latest, against the dates first booked.
  const dateChanges = booking.date_changes ?? [];
  const dateChange = dateChanges[0];
  const originalDates = dateChanges[dateChanges.length - 1]?.from;
  // The voucher the customer shows the shop at pickup — once the shop has confirmed.
  const hasVoucher = ["confirmed", "active", "completed"].includes(booking.status);

  // Voucher or agreement PDF: view in a new tab, or download as "<booking no>.pdf".
  const openPdf = (kind, download) => {
    // View opens /documents/... in a new tab, which loads the PDF itself.
    if (!download) {
      window.open(`/documents/customer/${reference}/${kind}`, "_blank");
      return;
    }
    setPdfBusy(kind);
    customerService.bookings[kind](reference, true)
      .then((res) => downloadBlob(res.data, `${reference}.pdf`))
      .catch(() => { toast.error(kind === "voucher" ? "Could not load the booking voucher" : "Could not load the rental agreement"); })
      .finally(() => setPdfBusy(null));
  };

  // The shop's terms you signed at handover (the agreement exists once the booking is confirmed).
  const agreement = booking.agreement ?? {};

  return (
    <div className="space-y-4">
      <Link href="/account/bookings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to bookings
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{booking.vehicle?.title}</h1>
            <p className="text-sm text-muted-foreground">{booking.booking_reference}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasVoucher && (
            <>
              <PdfMenu label="Voucher" icon={FileText} loading={pdfBusy === "voucher"} onView={() => openPdf("voucher", false)} onDownload={() => openPdf("voucher", true)} />
              {(agreement.signed || agreement.has_terms) && (
                <PdfMenu
                  label={agreement.signed ? "Signed agreement" : "Shop terms"}
                  icon={ScrollText}
                  title={agreement.signed ? "You signed this at pickup" : "You'll sign this at pickup"}
                  loading={pdfBusy === "agreement"}
                  onView={() => openPdf("agreement", false)}
                  onDownload={() => openPdf("agreement", true)}
                />
              )}
            </>
          )}
          <StatusBadge status={booking.status} />
        </div>
      </div>
      {hasVoucher && ["confirmed", "active"].includes(booking.status) && (
        <p className="-mt-2 text-xs text-muted-foreground">Show the voucher to the shop at pickup, printed or on your phone, with your driving licence and NIC/passport.</p>
      )}

      {dateChange && (
        <StatusBanner
          icon={CalendarClock}
          tone="warning"
          title={`The shop changed your dates on ${formatDateTime(dateChange.changed_at)}`}
          body={`Originally ${originalDates}. Now ${dateChange.to}.${dateChange.reason ? ` Reason: ${dateChange.reason}` : ""}${dateChanges.length > 1 ? ` (changed ${dateChanges.length} times)` : ""}`}
        />
      )}

      {booking.status === "confirmed" && (
        isBank
          ? <StatusBanner icon={Landmark} tone="success" title="Booking confirmed" body={Number(booking.balance_due) > 0
              ? `Transfer to the shop's bank account below and upload the receipt — ${format(booking.balance_due)} still to pay.`
              : "Fully paid by bank transfer — see you at pickup!"} />
          : <StatusBanner icon={Banknote} tone="success" title="Booking confirmed" body={`Pay the shop ${format(booking.pricing?.total_payable)} in cash when you pick up the vehicle.`} />
      )}
      {booking.status === "pending" && paidToShop && (
        <StatusBanner
          icon={isBank ? Landmark : Clock}
          tone="info"
          title="Waiting for the shop to confirm"
          body={isBank
            ? "Nothing to pay yet. Once the shop confirms, their bank details appear here — transfer the advance or the full amount and upload the receipt."
            : "Nothing to pay yet. Once the shop confirms, you pay them in cash when you pick up the vehicle."}
        />
      )}
      {booking.status === "rejected" && booking.rejection_reason && (
        <StatusBanner icon={XCircle} tone="destructive" title="Booking rejected" body={booking.rejection_reason} />
      )}
      {booking.cancellation_reason && (
        <StatusBanner icon={Ban} tone="info" title="Cancelled" body={booking.cancellation_reason} />
      )}
      {booking.has_open_dispute && (
        <StatusBanner
          icon={AlertTriangle}
          tone="warning"
          title="A dispute is open on this booking"
        />
      )}

      <Card className="rounded-2xl shadow-sm">
        <SectionHeader icon={CalendarRange} title="Rental Details" />
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><p className="text-muted-foreground">Pickup</p><p className="font-medium">{formatDateTime(booking.pickup_at)}</p></div>
          <div><p className="text-muted-foreground">Return</p><p className="font-medium">{formatDateTime(booking.return_at)}</p></div>
          <div><p className="text-muted-foreground">Duration</p><p className="font-medium">{booking.rental_days} day(s)</p></div>
          <div><p className="text-muted-foreground">Vehicle Reg. No.</p><p className="font-medium">{booking.vehicle?.registration_number}</p></div>
          <div>
            <p className="text-muted-foreground">Payment</p>
            <p className="flex items-center gap-1.5 font-medium">
              {isBank ? <><Landmark className="h-4 w-4" /> Bank transfer to the shop</> : isCash ? <><Banknote className="h-4 w-4" /> Cash at pickup</> : "Online"}
            </p>
          </div>
          {paidToShop && booking.balance_due != null && !["pending", "rejected", "expired"].includes(booking.status) && !booking.status.startsWith("cancelled") && (
            <div>
              <p className="text-muted-foreground">Payment status</p>
              <p className="font-medium">{Number(booking.balance_due) > 0 ? `${format(booking.balance_due)} due` : "Fully paid"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <SectionHeader icon={MapPin} title="Shop Contact" />
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{booking.shop?.name}</p>
          {booking.shop?.phone && <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {booking.shop.phone}</p>}
          {booking.pickup_location && <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {booking.pickup_location.name}</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <SectionHeader icon={Receipt} title="Price Breakdown" />
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Base rental</span><span>{format(pricing.base_amount)}</span></div>
          {Number(pricing.driver_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Driver</span><span>{format(pricing.driver_amount)}</span></div>}
          {Number(pricing.delivery_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{format(pricing.delivery_amount)}</span></div>}
          {Number(pricing.tax_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{format(pricing.tax_amount)}</span></div>}
          {Number(pricing.security_deposit) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Security deposit</span><span>{format(pricing.security_deposit)}</span></div>}
          <div className="flex justify-between border-t pt-1.5 font-semibold"><span>{isCash ? "Pay in cash at pickup" : "Total payable"}</span><span>{format(pricing.total_payable)}</span></div>
          {paidToShop && Number(booking.amount_paid) > 0 && (
            <>
              <div className="flex justify-between text-emerald-600"><span>Paid</span><span>− {format(booking.amount_paid)}</span></div>
              <div className="flex justify-between font-semibold"><span>Balance</span><span>{format(booking.balance_due)}</span></div>
            </>
          )}
          {paidToShop && <p className="pt-1 text-xs text-muted-foreground">Paid directly to the shop — any security deposit is refundable on return.</p>}
        </CardContent>
      </Card>

      {isBank && ["confirmed", "active"].includes(booking.status) ? (
        <BankTransferCard key={`${booking.balance_due}-${booking.payments?.length}`} booking={booking} />
      ) : paidToShop && booking.payments?.length > 0 && (
        // Cash bookings (and bank-transfer ones once the trip is over): the same payment history, read-only.
        <Card className="rounded-2xl shadow-sm">
          <SectionHeader icon={Wallet} title="Payments" />
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Paid {format(booking.amount_paid ?? 0)}{Number(booking.balance_due) > 0 ? ` · ${format(booking.balance_due)} still due` : " · fully paid"}
            </p>
            <CustomerPaymentsList booking={booking} />
          </CardContent>
        </Card>
      )}

      {paidToShop && policies.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <SectionHeader icon={ScrollText} title="Shop Policies" />
          <CardContent className="space-y-3 text-sm">
            {policies.map((p, i) => (
              <div key={i}>
                <p className="font-medium">{p.title}</p>
                <p className="whitespace-pre-line text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mustContactShop && (
        <p className="text-right text-sm text-muted-foreground">
          To cancel, contact {booking.shop?.name ?? "the shop"}{booking.shop?.phone ? ` on ${booking.shop.phone}` : ""} — refunds follow their policy.
        </p>
      )}

      {booking.customer_note && (
        <Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Your Note</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{booking.customer_note}</CardContent></Card>
      )}

      {booking.review && (
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
          You rated this rental {booking.review.rating}/5 — <StatusBadge status={booking.review.status} />
        </div>
      )}

      {(canCancel || canReview) && (
        <div className="flex flex-wrap justify-end gap-2">
          {canCancel && (
            <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setCancelling(true)}>
              Cancel Booking
            </Button>
          )}
          {canReview && (
            <Button variant="outline" className="gap-1.5" onClick={() => setReviewing(true)}>
              <Star className="h-4 w-4" /> Write a Review
            </Button>
          )}
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

      <WriteReviewDialog
        open={reviewing}
        onOpenChange={setReviewing}
        onSubmit={handleReviewSubmit}
        loading={submitReview.isPending}
      />
    </div>
  );
}
