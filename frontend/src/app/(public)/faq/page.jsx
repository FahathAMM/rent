"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HelpPageHero } from "@/components/public/HelpPageHero";
import { groupBySection, useHelpItems } from "@/hooks/useHelpItems";
import { ChevronDown, Loader2 } from "lucide-react";

export default function FaqPage() {
  const { data = [], isLoading, isError } = useHelpItems();
  const sections = groupBySection(data.filter((item) => item.type === "faq"));

  return (
    <div>
      <HelpPageHero
        title="Frequently asked questions"
        description="Answers about booking, payments, cancellations and disputes."
      />

      <div className="mx-auto max-w-3xl space-y-10 px-4 py-14">
        {isLoading && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {isError && <p className="text-center text-sm text-muted-foreground">We couldn&apos;t load the FAQ. Please refresh the page.</p>}

        {sections.map(({ name, items }) => (
          <section key={name}>
            <h2 className="mb-4 text-xl font-semibold tracking-tight">{name}</h2>
            <div className="divide-y rounded-2xl border bg-card shadow-sm">
              {items.map(({ id, title, body }) => (
                <details key={id} className="group p-4 sm:px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {title}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{body}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Still need help?</h2>
          <div className="mt-6 flex justify-center">
            <Button asChild><Link href="/contact">Contact us</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
