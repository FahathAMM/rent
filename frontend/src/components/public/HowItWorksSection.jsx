import { useTranslations } from "next-intl";
import { ClipboardList, CalendarCheck, KeyRound } from "lucide-react";

const STEPS = [
  { icon: ClipboardList, key: "search" },
  { icon: CalendarCheck, key: "request" },
  { icon: KeyRound, key: "pickup" },
];

/** The 3-step grid, reused inline on the homepage and as the body of the dedicated /how-it-works page — the caller supplies its own heading/wrapper. */
export function HowItWorksSection() {
  const t = useTranslations("howItWorksSteps");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
      {STEPS.map(({ icon: Icon, key }, i) => (
        // phones: icon beside the text; sm+: stacked card
        <div key={key} className="relative flex gap-3.5 rounded-2xl border bg-card p-4 shadow-sm sm:block sm:p-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground sm:mt-4 sm:text-xs">{t("step", { n: i + 1 })}</p>
            <h3 className="mt-0.5 font-semibold sm:mt-1">{t(`${key}.title`)}</h3>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-1.5">{t(`${key}.body`)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
