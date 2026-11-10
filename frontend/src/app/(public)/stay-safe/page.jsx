"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HelpPageHero } from "@/components/public/HelpPageHero";
import { groupBySection, useHelpItems } from "@/hooks/useHelpItems";
import { CheckCircle2, Loader2, PhoneCall, ShieldCheck, TriangleAlert } from "lucide-react";

export default function StaySafePage() {
  const { data = [], isLoading, isError } = useHelpItems();
  const ofType = (type) => data.filter((item) => item.type === type);

  const sections = groupBySection(ofType("safety_tip"));
  const warningSigns = ofType("warning_sign");
  const emergencyContacts = ofType("emergency_contact");

  return (
    <div>
      <HelpPageHero
        title="Stay safe"
        description="A few simple checks help protect you and your money, whether you are renting or buying."
      />

      <div className="mx-auto max-w-6xl px-4 py-14">
        {isLoading && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {isError && <p className="text-center text-sm text-muted-foreground">We couldn&apos;t load this page. Please refresh and try again.</p>}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {sections.map(({ name, items }) => (
            <section key={name} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="font-semibold">{name}</h2>
              </div>
              <ul className="mt-4 space-y-2.5">
                {items.map(({ id, title }) => (
                  <li key={id} className="flex gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{title}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {(warningSigns.length > 0 || emergencyContacts.length > 0) && (
        <div className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-14 lg:grid-cols-3">
            {warningSigns.length > 0 && (
              <section className="rounded-2xl border bg-card p-6 shadow-sm lg:col-span-2">
                <div className="flex items-center gap-3">
                  <TriangleAlert className="h-5 w-5 shrink-0 text-primary" />
                  <h2 className="font-semibold">Warning signs</h2>
                </div>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {warningSigns.map(({ id, title }) => <li key={id}>{title}</li>)}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  Spotted one? Don&apos;t pay. Use <span className="font-medium text-foreground">Report this listing</span> on the vehicle page, or raise a dispute if you already have a booking.
                </p>
              </section>
            )}

            {emergencyContacts.length > 0 && (
              <section className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <PhoneCall className="h-5 w-5 shrink-0 text-primary" />
                  <h2 className="font-semibold">In an emergency</h2>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">If anyone is in danger, call for help first, then tell the shop.</p>
                <dl className="mt-4 space-y-2 text-sm">
                  {emergencyContacts.map(({ id, title, body }) => (
                    <div key={id} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{title}</dt>
                      <dd><a href={`tel:${body.replace(/[^\d+]/g, "")}`} className="font-semibold hover:underline">{body}</a></dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-14 text-center">
        <h2 className="text-xl font-semibold tracking-tight">Need help with a booking?</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild><Link href="/contact">Contact us</Link></Button>
          <Button asChild variant="outline"><Link href="/faq">Read the FAQ</Link></Button>
        </div>
      </div>
    </div>
  );
}
