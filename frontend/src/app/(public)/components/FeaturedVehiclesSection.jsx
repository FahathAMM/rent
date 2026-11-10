import { useTranslations } from "next-intl";
import { SectionHeader } from "@/components/public/SectionHeader";
import { VehicleCard } from "@/app/(public)/rent/components/VehicleCard";

/** Top picks from the rental catalogue. */
export function FeaturedVehiclesSection({ featured }) {
  const t = useTranslations("home.featured");
  return (
    <section className="bg-muted/30 py-6 sm:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} href="/rent" />
        {featured?.data?.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {featured.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed bg-card py-16 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        )}
      </div>
    </section>
  );
}
