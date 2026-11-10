"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { HelpPageHero } from "@/components/public/HelpPageHero";
import {
  ArrowRight,
  CalendarCheck,
  CarFront,
  Handshake,
  KeyRound,
  Lightbulb,
  MessageSquareHeart,
  RotateCcw,
  Search,
  UserPlus,
  Wallet,
} from "lucide-react";

/** Icon and "go there" link for each guide section; the text lives in messages/{locale}.json under guide.sections. */
const SECTION_META = {
  account: { icon: UserPlus, href: "/register" },
  find: { icon: Search, href: "/rent" },
  book: { icon: CalendarCheck, href: "/rent" },
  pay: { icon: Wallet, href: "/account/bookings" },
  pickup: { icon: KeyRound, href: "/account/bookings" },
  buy: { icon: CarFront, href: "/buy" },
  cancel: { icon: RotateCcw, href: "/account/bookings" },
  after: { icon: MessageSquareHeart, href: "/stay-safe" },
};

export default function CustomerGuidePage() {
  const t = useTranslations("guide");
  const sections = t.raw("sections");

  return (
    <div>
      <HelpPageHero title={t("title")} description={t("description")} />

      <nav aria-label={t("onThisPage")} className="sticky top-16 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {sections.map(({ id, title }, i) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {i + 1}. {title}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-14">
        {sections.map(({ id, title, intro, steps, tip, link }, i) => {
          const { icon: Icon, href } = SECTION_META[id] ?? { icon: Handshake };
          return (
            <section key={id} id={id} className="scroll-mt-32 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">{t("step", { n: i + 1 })}</p>
                  <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                  {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
                </div>
              </div>

              <ol className="mt-5 space-y-3">
                {steps.map((step, n) => (
                  <li key={n} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {n + 1}
                    </span>
                    <span className="pt-0.5 text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>

              {tip && (
                <div className="mt-5 flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    <span className="font-semibold">{t("tip")} </span>
                    <span className="text-muted-foreground">{tip}</span>
                  </p>
                </div>
              )}

              {link && href && (
                <Button asChild variant="outline" size="sm" className="mt-5">
                  <Link href={href}>{link} <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
              )}
            </section>
          );
        })}
      </div>

      <div className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-xl font-semibold tracking-tight">{t("ctaTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("ctaBody")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
              <Link href="/rent">{t("ctaRent")}</Link>
            </Button>
            <Button asChild variant="outline"><Link href="/buy">{t("ctaBuy")}</Link></Button>
            <Button asChild variant="ghost"><Link href="/contact">{t("ctaHelp")}</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
