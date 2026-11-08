"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { customerService } from "@/services/customerService";
import { useCustomerAuthStore } from "@/store/customerAuthStore";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Button } from "@/components/ui/button";
import { BookingDateRange } from "./BookingDateRange";
import { CheckboxInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Banknote, Landmark, Loader2 } from "lucide-react";
import { APP_TIMEZONE_OFFSET, cn } from "@/lib/utils";
import { toast } from "sonner";

// What a signed-out customer had filled in when they hit "Log in to book",
// kept for this tab only so the request picks up where it left off after
// login/register (see LoginPanel/RegisterPanel's `next`).
const draftKey = (vehicleId) => `booking-draft:${vehicleId}`;

function readDraft(vehicleId) {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(vehicleId)) ?? "null");
  } catch {
    return null;
  }
}

function writeDraft(vehicleId, draft) {
  try {
    if (draft) sessionStorage.setItem(draftKey(vehicleId), JSON.stringify(draft));
    else sessionStorage.removeItem(draftKey(vehicleId));
  } catch {
    // Storage blocked (private mode etc.) — the customer just re-enters their dates.
  }
}

function daysBetween(from, to) {
  if (!from || !to) return 0;
  const ms = new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`);
  return Math.max(1, Math.round(ms / 86400000));
}

/**
 * Submits -> pending (see app-doc/marketplace/04-lifecycles.md). The shop
 * chooses default pickup and return times in its profile settings.
 */
export function BookingRequestWidget({ vehicle }) {
  const router = useRouter();
  const { isAuthenticated } = useCustomerAuthStore();
  const { format } = useCurrencyFormat();
  const t = useTranslations("booking");
  const [range, setRange] = useState({ from: "", to: "" });
  const [withDriver, setWithDriver] = useState(false);
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [errors, setErrors] = useState({});
  const containerRef = useRef(null);

  // The customer pays the shop directly: cash at pickup, or a bank transfer when the shop has a bank account on file.
  const canTransfer = !!vehicle.shop?.accepts_bank_transfer;
  const advancePct = vehicle.shop?.advance_percentage != null ? Number(vehicle.shop.advance_percentage) : null;

  // Back from login/register with a saved draft → refill it and bring the widget into view.
  useEffect(() => {
    const draft = readDraft(vehicle.id);
    if (!draft) return;
    setRange(draft.range ?? { from: "", to: "" });
    setWithDriver(!!draft.withDriver);
    setDeliveryRequested(!!draft.deliveryRequested);
    setNote(draft.note ?? "");
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (isAuthenticated) {
      writeDraft(vehicle.id, null);
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.info(t("welcomeBack"));
    }
  }, [vehicle.id, isAuthenticated]);

  const create = useMutation({
    mutationFn: customerService.bookings.create,
    onSuccess: (res) => {
      writeDraft(vehicle.id, null);
      toast.success(t("requestSent"));
      router.push(`/account/bookings/${res.data.data.booking_reference}`);
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {};
      setErrors(apiErrors);
      if (!Object.keys(apiErrors).length) {
        toast.error(err.response?.data?.message ?? t("submitError"));
      }
    },
  });

  const rentalDays = daysBetween(range.from, range.to);
  const pricing = vehicle.pricing;
  const pickupTime = vehicle.shop?.booking_pickup_time?.slice(0, 5) || "10:00";
  const returnTime = vehicle.shop?.booking_return_time?.slice(0, 5) || "10:00";

  const estimate = useMemo(() => {
    if (!rentalDays || !pricing) return null;
    const base = Number(pricing.daily_rate) * rentalDays;
    const driver = withDriver ? Number(pricing.driver_rate_per_day ?? 0) * rentalDays : 0;
    const delivery = deliveryRequested && pricing.delivery_available ? Number(pricing.delivery_flat_fee ?? 0) : 0;
    const tax = Math.round((base + driver + delivery) * Number(pricing.tax_rate ?? 0)) / 100;
    const deposit = Number(pricing.security_deposit ?? 0);
    // Must match BookingPricingCalculator: everything the shop collects, deposit included unless waived.
    return {
      base, driver, delivery, tax, deposit,
      total: base + driver + delivery + tax + (pricing.deposit_method !== "waived" ? deposit : 0),
    };
  }, [rentalDays, pricing, withDriver, deliveryRequested]);
  // Same rule as BankTransferService::advanceAmount(): % of the total, rounded up. Bank transfer totals include any non-waived deposit.
  const advance = advancePct && estimate ? Math.ceil((estimate.total * advancePct) / 100) : null;

  const handleSubmit = () => {
    setErrors({});

    if (!isAuthenticated) {
      writeDraft(vehicle.id, { range, withDriver, deliveryRequested, note, paymentMethod });
      router.push(`/login?next=${encodeURIComponent(`/vehicles/${vehicle.slug}`)}`);
      return;
    }

    if (!range.from || !range.to) {
      setErrors({ return_at: [t("pickDates")] });
      return;
    }

    create.mutate({
      vehicle_id: vehicle.id,
      pickup_at: `${range.from}T${pickupTime}:00${APP_TIMEZONE_OFFSET}`,
      return_at: `${range.to}T${returnTime}:00${APP_TIMEZONE_OFFSET}`,
      with_driver: withDriver,
      delivery_requested: deliveryRequested,
      customer_note: note || undefined,
      payment_method: canTransfer ? paymentMethod : "cash",
    });
  };

  return (
    <div ref={containerRef} className="space-y-3 scroll-mt-24">
      <ValidationError errors={errors} />

      <BookingDateRange vehicle={vehicle} label={t("datesLabel")} value={range} onChange={setRange} placeholder={t("datesPlaceholder")} />
      <p className="text-xs text-muted-foreground">
        {t("times", { pickup: pickupTime, return: returnTime })}
      </p>

      {pricing?.driver_rate_per_day > 0 && (
        <CheckboxInput label={t("addDriver", { price: format(pricing.driver_rate_per_day) })} checked={withDriver} onChange={setWithDriver} />
      )}
      {pricing?.delivery_available && (
        <CheckboxInput label={t("addDelivery", { price: format(pricing.delivery_flat_fee ?? 0) })} checked={deliveryRequested} onChange={setDeliveryRequested} />
      )}

      {canTransfer && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("howPay")}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "cash", icon: Banknote, title: t("cash"), sub: t("cashSub") },
              { value: "bank_transfer", icon: Landmark, title: t("bank"), sub: advancePct ? (advance ? t("bankFromAdvance", { amount: format(advance), pct: advancePct }) : t("bankFromPct", { pct: advancePct })) : t("bankFull") },
            ].map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setPaymentMethod(o.value)}
                aria-pressed={paymentMethod === o.value}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left text-sm transition-colors",
                  paymentMethod === o.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-1.5 font-medium"><o.icon className="h-4 w-4" /> {o.title}</span>
                <span className="text-xs text-muted-foreground">{o.sub}</span>
              </button>
            ))}
          </div>
          {errors.payment_method?.[0] && <p className="text-xs text-destructive">{errors.payment_method[0]}</p>}
        </div>
      )}

      <TextareaInput label={t("noteLabel")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />

      {estimate && (
        <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("rental", { count: rentalDays })}</span><span>{format(estimate.base)}</span></div>
          {estimate.driver > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("driver")}</span><span>{format(estimate.driver)}</span></div>}
          {estimate.delivery > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("delivery")}</span><span>{format(estimate.delivery)}</span></div>}
          {estimate.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("tax", { rate: Number(pricing.tax_rate) })}</span><span>{format(estimate.tax)}</span></div>}
          {estimate.deposit > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("deposit")}</span>
              <span>{format(estimate.deposit)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-semibold"><span>{canTransfer && paymentMethod === "bank_transfer" ? t("totalBank") : t("totalCash")}</span><span>{format(estimate.total)}</span></div>
        </div>
      )}

      <Button className="w-full" size="lg" onClick={handleSubmit} disabled={create.isPending}>
        {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isAuthenticated ? t("request") : t("loginToBook")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {canTransfer && paymentMethod === "bank_transfer"
            ? t("footBank", {
                amount: advancePct
                  ? (advance ? t("footBankAdvanceAmount", { pct: advancePct, amount: format(advance) }) : t("footBankAdvance", { pct: advancePct }))
                  : t("footBankFull"),
              })
            : t("footCash")}
      </p>
    </div>
  );
}
