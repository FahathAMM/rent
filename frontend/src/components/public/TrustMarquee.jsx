import { ShieldCheck, Wallet, Clock, Headset, CreditCard, Star } from "lucide-react";

const POINTS = [
  { icon: ShieldCheck, label: "Verified rental shops" },
  { icon: Wallet, label: "No hidden fees" },
  { icon: Clock, label: "Instant booking requests" },
  { icon: CreditCard, label: "Secure online payments" },
  { icon: Star, label: "Real customer reviews" },
  { icon: Headset, label: "Shop support on every trip" },
];

/**
 * A continuously-scrolling trust ticker — real value props the app
 * actually delivers (verification, payments, reviews), not fabricated
 * discount percentages. The list is duplicated once so the CSS
 * translateX(-50%) loop in globals.css (.animate-marquee) seams
 * perfectly; pauses on hover there too.
 */
export function TrustMarquee() {
  const items = [...POINTS, ...POINTS];
  return (
    <div className="group overflow-hidden border-y bg-muted/30 py-3">
      <div className="animate-marquee flex w-max gap-10">
        {items.map(({ icon: Icon, label }, i) => (
          <span key={i} className="flex items-center gap-2 text-sm font-medium text-muted-foreground whitespace-nowrap">
            <Icon className="h-4 w-4 text-primary" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
