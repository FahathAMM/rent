import Link from "next/link";
import { ArrowRight, Calendar, Fuel, Gauge, MapPin, Route, ShieldCheck } from "lucide-react";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useEnumLabel } from "@/i18n/useEnumLabel";

/** The Buy page's list-view row — photo on the left, details and price beside it. */
export function SaleVehicleListItem({ vehicle, className }) {
  const { format } = useCurrencyFormat();
  const t = useTranslations("vehicleCard");
  const enumLabel = useEnumLabel();
  const image = vehicle.images?.find((i) => i.is_primary)?.url ?? vehicle.images?.[0]?.url ?? VEHICLE_PLACEHOLDER_IMAGE;
  const subtitle = [vehicle.category?.name, enumLabel("condition", vehicle.condition), vehicle.variant].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/buy/${vehicle.slug}`}
      className={cn("group flex overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg", className)}
    >
      <div className="relative w-28 shrink-0 self-stretch overflow-hidden bg-muted sm:w-64 md:w-72">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={vehicle.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {vehicle.is_featured && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm sm:left-2 sm:top-2 sm:px-2.5 sm:text-[10px]">{t("featured")}</span>
        )}
      </div>

      <div className="flex min-h-28 min-w-0 flex-1 flex-col gap-2 p-3 sm:min-h-44 sm:flex-row sm:gap-5 sm:p-4">
        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2.5">
          <div>
            <p className="truncate text-sm font-semibold leading-tight sm:text-base">{vehicle.title}</p>
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:gap-x-4 sm:gap-y-1.5 sm:text-xs">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{vehicle.year}</span>
            <span className="flex items-center gap-1"><Route className="h-3.5 w-3.5" />{t("km", { value: Number(vehicle.mileage_km ?? 0).toLocaleString() })}</span>
            <span className="flex items-center gap-1 capitalize"><Gauge className="h-3.5 w-3.5" />{enumLabel("transmission", vehicle.transmission)}</span>
            <span className="flex items-center gap-1 capitalize"><Fuel className="h-3.5 w-3.5" />{enumLabel("fuel", vehicle.fuel_type)}</span>
          </div>

          {vehicle.features?.length > 0 && (
            <div className="hidden flex-wrap gap-1.5 sm:flex">
              {vehicle.features.slice(0, 4).map((f) => (
                <span key={f} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{f}</span>
              ))}
              {vehicle.features.length > 4 && <span className="px-1 text-[11px] text-muted-foreground">{t("moreFeatures", { count: vehicle.features.length - 4 })}</span>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
            <span className="hidden items-center gap-1 sm:flex">
              {vehicle.shop?.name}
              {vehicle.shop?.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
            </span>
            {vehicle.shop?.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{vehicle.shop.city}</span>}
          </div>
        </div>

        <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t pt-2 sm:mt-0 sm:w-40 sm:flex-col sm:items-end sm:justify-between sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <div className="sm:text-right">
            <p className="text-base font-bold leading-tight sm:text-lg">{format(vehicle.price)}</p>
            {vehicle.is_negotiable && <p className="hidden text-[11px] text-muted-foreground sm:block">{t("negotiable")}</p>}
          </div>
          <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition-opacity group-hover:opacity-90 sm:px-3 sm:py-1.5 sm:text-xs">
            <span className="hidden sm:inline">{t("viewDetails")}</span><span className="sm:hidden">{t("view")}</span> <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
