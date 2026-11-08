import { SectionHeader } from "@/components/public/SectionHeader";
import { HowItWorksSection } from "@/components/public/HowItWorksSection";

/** The renting steps, with the home page's heading and background. */
export function HomeHowItWorksSection() {
  return (
    <section className="relative isolate overflow-hidden border-y bg-muted/30">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
        <div className="aurora-blob aurora-blob-2" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <SectionHeader center eyebrow="Easy as 1-2-3" title="How it works" highlight="it works" subtitle="From search to keys in hand." href="/how-it-works" linkLabel="How renting and buying work" />
        <HowItWorksSection />
      </div>
    </section>
  );
}
