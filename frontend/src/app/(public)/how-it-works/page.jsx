import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HowItWorksSection } from "@/components/public/HowItWorksSection";
import { ShieldCheck, Wallet, Clock, ArrowRight } from "lucide-react";

const FOR_SHOPS = [
  { title: "Register your shop", body: "Tell us about your rental business and upload your business registration — it only takes a few minutes." },
  { title: "Get verified", body: "Our team reviews your documents and publishes your shop once verified." },
  { title: "Get booked & paid", body: "Accept booking requests, hand the vehicle over, and get paid out automatically." },
];

export default function HowItWorksPage() {
  return (
    <div>
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-grain" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Renting a vehicle — or listing your shop&apos;s fleet — only takes a few steps.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-8 text-center text-xl font-semibold tracking-tight">For renters</h2>
        <HowItWorksSection />
      </div>

      <div className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-8 text-center text-xl font-semibold tracking-tight">For rental shops</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {FOR_SHOPS.map(({ title, body }, i) => (
              <div key={title} className="rounded-2xl border bg-card p-6 shadow-sm">
                <p className="text-xs font-semibold text-muted-foreground">STEP {i + 1}</p>
                <h3 className="mt-1 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
              <Link href="/vendor/register">Register your shop <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-2xl border bg-card p-5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Verified shops</h3>
              <p className="mt-1 text-sm text-muted-foreground">Every rental shop is verified before it can publish a listing.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border bg-card p-5">
            <Wallet className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">No hidden fees</h3>
              <p className="mt-1 text-sm text-muted-foreground">The price you see at booking is the price you pay — no surprise charges at pickup.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border bg-card p-5">
            <Clock className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Fast booking requests</h3>
              <p className="mt-1 text-sm text-muted-foreground">Shops typically respond within hours, not days.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
