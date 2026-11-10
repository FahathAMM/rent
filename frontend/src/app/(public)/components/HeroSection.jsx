"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { HeroSlideshow } from "@/components/public/HeroSlideshow";
import { ArrowRight, BadgeDollarSign, Building2, CarFront, Clock, Search, ShieldCheck, Wallet } from "lucide-react";

const TRUST_POINTS = [
  { icon: ShieldCheck, key: "verified" },
  { icon: Wallet, key: "noHiddenFees" },
  { icon: Clock, key: "fastReplies" },
];

function HeroStat({ icon: Icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2 py-2.5 text-center backdrop-blur-md sm:flex-row sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left">
      <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:flex"><Icon className="h-4 w-4 text-orange-200" /></div>
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight sm:text-lg">{value}</p>
        <p className="text-[10px] leading-tight text-white/70 sm:text-[11px]">{label}</p>
      </div>
    </div>
  );
}

const SEARCH_MODES = [
  { id: "rent", icon: CarFront },
  { id: "buy", icon: BadgeDollarSign },
];

/** The home page hero: slideshow, headline, search card, shortcuts and stats. */
export function HeroSection({ featured, saleTotal, heroSlides, categories, allDistricts, shopsTotal }) {
  const router = useRouter();
  const t = useTranslations("home.hero");
  const [mode, setMode] = useState("rent");
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const heroSlide = heroSlides?.length ? heroSlides[heroIndex % heroSlides.length] : null;

  // All 25 districts, not only ones with listings — same as the Rent page filter.
  const districts = (allDistricts ?? []).map((d) => d.name).sort();

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (district) params.set("district", district);
    if (category) params.set("category_id", category);
    const qs = params.toString();
    router.push(qs ? `/${mode}?${qs}` : `/${mode}`);
  };

  const stats = [
    { icon: CarFront, value: featured?.meta?.total ?? "—", label: t("stats.forRent") },
    { icon: BadgeDollarSign, value: saleTotal ?? "—", label: t("stats.forSale") },
    { icon: Building2, value: shopsTotal ?? "—", label: t("stats.shops") },
  ];

  return (
    <section className="relative isolate overflow-hidden border-b">
      <HeroSlideshow vehicles={featured?.data} platformSlides={heroSlides} onActiveChange={setHeroIndex} />

      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-5 text-center text-white sm:pb-8 sm:pt-8">
        {/* Fixed-height headline area: every slide (and the default headline) gets the same box,
            with long text clamped to two lines, so the hero never changes height as slides rotate. */}
        <div className="flex h-[196px] flex-col items-center justify-center sm:h-[212px]">
        {heroSlide ? (
          // Platform-managed slide: its headline replaces the default one and changes with each slide.
          <div key={heroSlide.id} className="animate-in fade-in slide-in-from-bottom-2 duration-700">
            <h1 className="mx-auto line-clamp-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.02em] text-balance drop-shadow-sm sm:text-4xl">
              {heroSlide.title}
            </h1>
            {heroSlide.subtitle && (
              <p className="mx-auto mt-3 line-clamp-2 max-w-xl text-base text-white/80 text-pretty">{heroSlide.subtitle}</p>
            )}
            {heroSlide.link_url && (
              <Button asChild size="lg" className="mt-4 rounded-full bg-white px-6 text-foreground shadow-lg hover:bg-white/90">
                {heroSlide.link_url.startsWith("/") ? (
                  <Link href={heroSlide.link_url}>{heroSlide.link_label || t("learnMore")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                ) : (
                  <a href={heroSlide.link_url} target="_blank" rel="noopener noreferrer">{heroSlide.link_label || t("learnMore")} <ArrowRight className="ml-2 h-4 w-4" /></a>
                )}
              </Button>
            )}
          </div>
        ) : (
          <>
            <h1 className="line-clamp-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-balance drop-shadow-sm sm:text-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
              {t.rich("headline", {
                accent: (chunks) => (
                  <span className="bg-gradient-to-r from-orange-300 via-pink-300 to-violet-300 bg-clip-text text-transparent">{chunks}</span>
                ),
              })}
            </h1>
            <p className="mx-auto mt-3 line-clamp-2 max-w-xl text-base text-white/80 text-pretty">
              {t("subheadline")}
            </p>
          </>
        )}
        </div>

        {/* Search card — Rent / Buy is its first field */}
        <form
          onSubmit={handleSearch}
          className="mx-auto mt-4 flex max-w-4xl flex-col gap-2 rounded-2xl border border-white/20 bg-card/95 p-2 text-left text-foreground shadow-2xl backdrop-blur-md sm:flex-row sm:items-stretch"
        >
          <div className="min-w-0 rounded-xl px-1 sm:w-44 sm:shrink-0 sm:border-r sm:border-border/60">
            <span className="block px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("lookingTo")}</span>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-8 border-0 bg-transparent font-medium shadow-none focus:ring-0" aria-label={t("rentOrBuy")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_MODES.map(({ id, icon: Icon }) => (
                  <SelectItem key={id} value={id}>
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> {t(id)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex min-w-0 items-center gap-2.5 rounded-xl px-3 sm:flex-[1.4] sm:border-r sm:border-border/60">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <span className="block pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("what")}</span>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("keywordPlaceholder")}
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </label>
          <div className="min-w-0 rounded-xl px-1 sm:flex-1 sm:border-r sm:border-border/60">
            <span className="block px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("where")}</span>
            <Select value={district || "all"} onValueChange={(v) => setDistrict(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue placeholder={t("anyDistrict")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("anyDistrict")}</SelectItem>
                {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 rounded-xl px-1 sm:flex-1">
            <span className="block px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("type")}</span>
            <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue placeholder={t("anyVehicle")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("anyVehicle")}</SelectItem>
                {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="lg" className="min-h-12 shrink-0 rounded-xl sm:h-auto bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-5 hover:opacity-90 lg:px-7">
            <Search className="mr-2 h-4 w-4" /> {t("search")}
          </Button>
        </form>

        {/* Popular category shortcuts */}
        {categories?.length > 0 && (
          <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-white/70">{t("popular")}</span>
            {categories.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                href={`/${mode}?category_id=${c.id}`}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mx-auto mt-5 grid max-w-3xl grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
          {stats.map((s) => <HeroStat key={s.label} {...s} />)}
        </div>

        <div className="mx-auto mt-4 hidden flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80 sm:flex">
          {TRUST_POINTS.map(({ icon: Icon, key }) => (
            <span key={key} className="flex items-center gap-1.5">
              <Icon className="h-4 w-4 text-orange-300" /> {t(`trust.${key}`)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
