import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ArrowRight, Banknote, CalendarCheck, TrendingUp, Users } from "lucide-react";

/** The call to action for shops. */
export function OwnerCtaSection({ brandName }) {
  const t = useTranslations("home.ownerCta");
  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-600 px-5 py-8 text-white shadow-2xl sm:px-12 sm:py-12">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-900/30 blur-3xl" aria-hidden="true" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(135deg,#fff_0_1px,transparent_1px_14px)]" aria-hidden="true" />

        <div className="relative grid gap-6 sm:gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">{t("eyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">{t("title", { brand: brandName })}</h2>
            <p className="mt-3 max-w-lg text-white/85">
              {t("body")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-foreground shadow-lg hover:bg-white/90">
                <Link href="/vendor/register">{t("register")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link href="/how-it-works">{t("howItWorks")}</Link>
              </Button>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { icon: TrendingUp, key: "reach" },
              { icon: CalendarCheck, key: "manage" },
              { icon: Banknote, key: "earnings" },
              { icon: Users, key: "staff" },
            ].map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-xs backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20"><Icon className="h-4 w-4" /></span>
                {t(`points.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
