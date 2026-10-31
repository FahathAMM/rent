"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { bookingService } from "@/services/bookingService";
import { useCustomerAuthStore } from "@/store/customerAuthStore";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import { CheckboxInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function daysBetween(from, to) {
  if (!from || !to) return 0;
  const ms = new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`);
  return Math.max(1, Math.round(ms / 86400000));
}

/**
 * Submits -> pending (see app-doc/marketplace/04-lifecycles.md). Fixed
 * 10:00 pickup/return time rather than a separate time picker — matches
 * MarketplaceDemoSeeder's convention and keeps the first version of this
 * widget simple; a time picker is a small, isolated follow-up, not a
 * structural change.
 */
export function BookingRequestWidget({ vehicle }) {
  const router = useRouter();
  const { isAuthenticated } = useCustomerAuthStore();
  const { format } = useCurrencyFormat();
  const [range, setRange] = useState({ from: "", to: "" });
  const [withDriver, setWithDriver] = useState(false);
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});

  const create = useMutation({
    mutationFn: bookingService.create,
    onSuccess: (res) => {
      toast.success("Booking request sent — the owner will respond soon");
      router.push(`/account/bookings/${res.data.data.booking_reference}`);
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {};
      setErrors(apiErrors);
      if (!Object.keys(apiErrors).length) {
        toast.error(err.response?.data?.message ?? "Could not submit request");
      }
    },
  });

  const rentalDays = daysBetween(range.from, range.to);
  const pricing = vehicle.pricing;

  const estimate = useMemo(() => {
    if (!rentalDays || !pricing) return null;
    const base = Number(pricing.daily_rate) * rentalDays;
    const driver = withDriver ? Number(pricing.driver_rate_per_day ?? 0) * rentalDays : 0;
    const delivery = deliveryRequested && pricing.delivery_available ? Number(pricing.delivery_flat_fee ?? 0) : 0;
    const deposit = Number(pricing.security_deposit ?? 0);
    // Only a prepaid deposit is paid through the gateway with the rental —
    // cash_on_pickup is collected by the shop in person, so it's shown but
    // excluded from "pay now". Must match BookingPricingCalculator exactly,
    // since that's what the real charge will be.
    const depositPrepaid = pricing.deposit_method === "prepaid";
    return {
      base, driver, delivery, deposit, depositPrepaid,
      total: base + driver + delivery + (depositPrepaid ? deposit : 0),
    };
  }, [rentalDays, pricing, withDriver, deliveryRequested]);

  const handleSubmit = () => {
    setErrors({});

    if (!isAuthenticated) {
      router.push(`/login?next=/vehicles/${vehicle.slug}`);
      return;
    }

    if (!range.from || !range.to) {
      setErrors({ return_at: ["Pick your pickup and return dates."] });
      return;
    }

    create.mutate({
      vehicle_id: vehicle.id,
      pickup_at: `${range.from}T10:00:00`,
      return_at: `${range.to}T10:00:00`,
      with_driver: withDriver,
      delivery_requested: deliveryRequested,
      customer_note: note || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <ValidationError errors={errors} />

      <DateRangePicker label="Pickup & return dates" value={range} onChange={setRange} placeholder="Choose your dates" />

      {pricing?.driver_rate_per_day > 0 && (
        <CheckboxInput label={`Add a driver (+${format(pricing.driver_rate_per_day)}/day)`} checked={withDriver} onChange={setWithDriver} />
      )}
      {pricing?.delivery_available && (
        <CheckboxInput label={`Delivery to my location (+${format(pricing.delivery_flat_fee ?? 0)})`} checked={deliveryRequested} onChange={setDeliveryRequested} />
      )}

      <TextareaInput label="Note to owner (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. arriving by flight, need it for a wedding..." />

      {estimate && (
        <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Rental ({rentalDays} day{rentalDays > 1 ? "s" : ""})</span><span>{format(estimate.base)}</span></div>
          {estimate.driver > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Driver</span><span>{format(estimate.driver)}</span></div>}
          {estimate.delivery > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{format(estimate.delivery)}</span></div>}
          {estimate.deposit > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Security deposit {estimate.depositPrepaid ? "" : "(pay at pickup)"}</span>
              <span>{format(estimate.deposit)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Pay now</span><span>{format(estimate.total)}</span></div>
        </div>
      )}

      <Button className="w-full" size="lg" onClick={handleSubmit} disabled={create.isPending}>
        {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isAuthenticated ? "Request to book" : "Log in to book"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        You won&apos;t be charged yet — the owner reviews your request first.
      </p>
    </div>
  );
}
