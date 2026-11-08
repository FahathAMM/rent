import { useTranslations } from "next-intl";
import { SectionHeader } from "@/components/public/SectionHeader";
import { SaleVehicleCard } from "@/app/(public)/buy/components/SaleVehicleCard";

/** Vehicles for sale, featured ones first. */
export function HomeSaleSection({ vehicles }) {
  const t = useTranslations("home.sale");
  return (
    <section className="py-6 sm:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader eyebrow={t("eyebrow")} title={t("title")} highlight={t("highlight")} subtitle={t("subtitle")} href="/buy" linkLabel={t("seeAll")} />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {vehicles.map((v) => <SaleVehicleCard key={v.id} vehicle={v} />)}
        </div>
      </div>
    </section>
  );
}
