"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { platformDetailService } from "@/services/platformDetailService";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { Globe, Linkedin } from "lucide-react";
import { visitService } from "@/services/visitService";

export function PublicFooter() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const tCommon = useTranslations("common");
  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const brandName = brand?.name || "LankaLane";
  const logoUrl = brand?.logo || null;
  const tagline = brand?.tagline || tCommon("defaultTagline");

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <BrandLogo
              logoUrl={logoUrl}
              brandName={brandName}
              imgClassName="h-7 w-auto"
              fallbackClassName="size-7 shrink-0 rounded-lg bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white"
              iconClassName="size-3.5"
            />
            {brandName}
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{tagline}</p>
        </div>

        <div>
          <p className="text-sm font-semibold">{t("explore")}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground">{t("home")}</Link></li>
            <li><Link href="/rent" className="hover:text-foreground">{tNav("rent")}</Link></li>
            <li><Link href="/buy" className="hover:text-foreground">{tNav("buy")}</Link></li>
            <li><Link href="/locations" className="hover:text-foreground">{tNav("location")}</Link></li>
            <li><Link href="/shops" className="hover:text-foreground">{tNav("shops")}</Link></li>
            <li><Link href="/how-it-works" className="hover:text-foreground">{t("howItWorks")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">{t("forOwners")}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/vendor/register" className="hover:text-foreground">{t("listVehicle")}</Link></li>
            <li><Link href="/vendor/register" className="hover:text-foreground">{t("registerBusiness")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">{t("account")}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/login" className="hover:text-foreground">{tHeader("signIn")}</Link></li>
            <li><Link href="/register" className="hover:text-foreground">{t("createAccount")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">{t("help")}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/guide" className="hover:text-foreground">{t("guide")}</Link></li>
            <li><Link href="/stay-safe" className="hover:text-foreground">{t("staySafe")}</Link></li>
            <li><Link href="/faq" className="hover:text-foreground">{t("faq")}</Link></li>
            <li><Link href="/contact" className="hover:text-foreground">{t("contact")}</Link></li>
            <li><Link href="/terms" className="hover:text-foreground">{t("terms")}</Link></li>
            <li><Link href="/privacy" className="hover:text-foreground">{t("privacy")}</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{t("rights", { year: new Date().getFullYear(), brand: brandName })}</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Developed by AMM. Fahath</span>
            <a
              href="https://www.linkedin.com/in/fahath-mohamed-3ab47416b/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => visitService.track("linkedin_click")}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Linkedin className="size-3.5 shrink-0" />
              LinkedIn
            </a>
            <a
              href="https://fahathamm.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => visitService.track("website_click")}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Globe className="size-3.5 shrink-0" />
              Portfolio
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
