"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HelpPageHero } from "@/components/public/HelpPageHero";
import { useHelpItems } from "@/hooks/useHelpItems";
import { Loader2 } from "lucide-react";

/** Numbered clauses of one help item type (terms, privacy). */
export function LegalPage({ type, title, description, question }) {
  const { data = [], isLoading, isError } = useHelpItems();
  const clauses = data.filter((item) => item.type === type);

  return (
    <div>
      <HelpPageHero title={title} description={description} />

      <div className="mx-auto max-w-3xl px-4 py-14">
        {isLoading && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {isError && <p className="text-center text-sm text-muted-foreground">We couldn&apos;t load this page. Please refresh and try again.</p>}

        <ol className="space-y-8">
          {clauses.map(({ id, title: heading, body }, index) => (
            <li key={id}>
              <h2 className="text-lg font-semibold tracking-tight">{index + 1}. {heading}</h2>
              {/* Rich text HTML, cleaned to plain formatting tags on the server. */}
              <div className="rich-text mt-2 text-sm leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: body }} />
            </li>
          ))}
        </ol>
      </div>

      <div className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-xl font-semibold tracking-tight">{question}</h2>
          <div className="mt-6 flex justify-center">
            <Button asChild><Link href="/contact">Contact us</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
