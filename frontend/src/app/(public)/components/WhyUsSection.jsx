import { SectionHeader } from "@/components/public/SectionHeader";
import { BadgeCheck, CalendarCheck, Layers, MessageCircle, ShieldCheck, Star } from "lucide-react";

// Only claims the product actually backs: shops are verified by the
// platform, listings are moderated, reviews come from completed bookings,
// and every shop's own policies are shown before booking.
const WHY_POINTS = [
  { icon: BadgeCheck, title: "Verified shops", body: "Every shop is a registered business, checked by our team before it can list a single vehicle." },
  { icon: ShieldCheck, title: "Moderated listings", body: "Each vehicle is reviewed before it goes live, so what you see is what you get." },
  { icon: Star, title: "Real reviews only", body: "Reviews can only be written after a completed rental — no fake ratings." },
  { icon: Layers, title: "Clear policies upfront", body: "Pickup, return and cancellation terms from each shop, visible before you request a booking." },
  { icon: MessageCircle, title: "Talk to the shop directly", body: "Call or WhatsApp the shop straight from their page — no middlemen." },
  { icon: CalendarCheck, title: "Book in minutes", body: "Send a request with your dates; the shop confirms and you're ready to go." },
];

export function WhyUsSection({ brandName }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <SectionHeader center eyebrow={`Why ${brandName}`} title="Your next ride, without the hassle" subtitle="Everything you need to rent or buy with confidence, in one place." />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {WHY_POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="group rounded-xl border bg-card p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:rounded-2xl sm:p-6">
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary transition-colors group-hover:from-orange-500 group-hover:via-pink-500 group-hover:to-violet-500 group-hover:text-white">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <h3 className="mt-2.5 text-sm font-semibold leading-snug sm:mt-4 sm:text-base">{title}</h3>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:mt-1.5 sm:line-clamp-none sm:text-sm">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
