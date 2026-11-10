"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calculator, Info, Sparkles } from "lucide-react";

const shortDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

/**
 * Turns an API `breakdown` (BookingPricing::breakdownFrom) into the popup's
 * `data`. Older bookings saved without rate lines show one daily line.
 */
export function breakdownData(b, rentalDays, totalLabel) {
  const days = Number(rentalDays) || 0;
  const base = Number(b.base_amount) || 0;
  const lines = b.rate_breakdown?.length
    ? b.rate_breakdown.map((l) => ({ plan: l.plan, units: Number(l.units), rate: Number(l.rate) }))
    : [{ plan: "daily", units: days, rate: days ? base / days : base }];
  return {
    lines,
    rentalDays: days,
    base,
    dailyRate: Number(b.daily_rate) || 0,
    hasDiscountRates: Number(b.weekly_rate) > 0 || Number(b.monthly_rate) > 0,
    driver: Number(b.driver_amount) || 0,
    driverRate: Number(b.driver_rate_per_day) || 0,
    delivery: Number(b.delivery_amount) || 0,
    taxRate: Number(b.tax_rate) || 0,
    tax: Number(b.tax_amount) || 0,
    deposit: Number(b.security_deposit) || 0,
    depositWaived: b.deposit_method === "waived",
    total: Number(b.total_payable) || 0,
    totalLabel,
  };
}

function Row({ label, sub, amount, strong, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${strong ? "font-semibold" : ""} ${className}`}>
      <div className="min-w-0">
        <p className={strong ? "" : "text-muted-foreground"}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className="shrink-0 tabular-nums">{amount}</span>
    </div>
  );
}

/**
 * Popup that spells out how a booking price is built: which days fall on the
 * monthly / weekly / daily rate, the extras, tax, deposit and total. Used by
 * the customer booking form and the shop's Change dates dialog.
 *
 * `data`: { lines: [{plan, units, rate}], rentalDays, base, dailyRate, hasDiscountRates,
 *   driver, driverRate, delivery, taxRate, tax, deposit, depositWaived, total, totalLabel,
 *   advance?, advancePct? }
 * `extraRows`: optional [{ label, sub?, amount, strong?, tone? }] shown after the total
 *   (e.g. already paid / balance due on a date change).
 */
export function PriceBreakdownDialog({ data, format, from, to, extraRows = [], className = "" }) {
  const t = useTranslations("booking");
  const atDailyOnly = data.dailyRate * data.rentalDays;
  // No quoted daily rate (very old bookings) → no savings line.
  const saving = data.dailyRate > 0 ? Math.round((atDailyOnly - data.base) * 100) / 100 : 0;
  const subtotal = data.base + data.driver + data.delivery;
  const lineLabel = { monthly: "breakdownMonths", weekly: "breakdownWeeks", daily: "breakdownDays" };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={`flex w-full items-center justify-center gap-1.5 pt-1 text-xs font-medium text-primary hover:underline ${className}`}>
          <Calculator className="h-3.5 w-3.5" /> {t("breakdownLink")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-5">
        <DialogHeader className="text-left">
          <DialogTitle>{t("breakdownTitle")}</DialogTitle>
          <DialogDescription>
            {t("breakdownDates", { from: shortDate(from), to: shortDate(to), count: data.rentalDays })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Rental: month / week / day lines */}
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("breakdownRental")}</p>
            <div className="space-y-1.5 rounded-lg border p-3">
              {data.lines.map((line) => (
                <Row
                  key={line.plan}
                  label={t(lineLabel[line.plan] ?? "breakdownDays", { count: line.units, rate: format(line.rate) })}
                  amount={format(line.units * line.rate)}
                />
              ))}
              <Row label={t("rental", { count: data.rentalDays })} amount={format(data.base)} strong className="border-t pt-1.5" />
            </div>
            {data.hasDiscountRates && (
              <p className="flex gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("breakdownRule")}
              </p>
            )}
            {saving > 0 && (
              <p className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Sparkles className="h-3.5 w-3.5 shrink-0" /> {t("breakdownSaving", { amount: format(saving), daily: format(atDailyOnly) })}
              </p>
            )}
          </section>

          {/* Extras, tax */}
          {(data.driver > 0 || data.delivery > 0 || data.tax > 0) && (
            <section className="space-y-1.5 rounded-lg border p-3">
              {data.driver > 0 && (
                <Row
                  label={t("driver")}
                  sub={t("breakdownDays", { count: data.rentalDays, rate: format(data.driverRate) })}
                  amount={format(data.driver)}
                />
              )}
              {data.delivery > 0 && <Row label={t("delivery")} sub={t("breakdownFlat")} amount={format(data.delivery)} />}
              <Row label={t("breakdownSubtotal")} amount={format(subtotal)} className="border-t pt-1.5" />
              {data.tax > 0 && <Row label={t("tax", { rate: Number(data.taxRate) })} amount={format(data.tax)} />}
            </section>
          )}

          {/* Deposit + total */}
          <section className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
            {data.deposit > 0 && (
              <Row
                label={t("deposit")}
                sub={data.depositWaived ? t("breakdownDepositWaived") : t("breakdownDepositNote")}
                amount={data.depositWaived ? <span className="line-through opacity-60">{format(data.deposit)}</span> : format(data.deposit)}
              />
            )}
            <Row label={data.totalLabel} amount={format(data.total)} strong className="border-t pt-1.5 text-base" />
            {data.advance > 0 && (
              <Row label={t("breakdownAdvance", { pct: data.advancePct })} sub={t("breakdownAdvanceNote")} amount={format(data.advance)} />
            )}
            {extraRows.map((r) => (
              <Row
                key={r.label}
                label={r.label}
                sub={r.sub}
                amount={format(r.amount)}
                strong={r.strong}
                className={r.tone === "warn" ? "text-amber-700 dark:text-amber-400" : ""}
              />
            ))}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
