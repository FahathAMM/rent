import { ClipboardList, CalendarCheck, KeyRound } from "lucide-react";

const STEPS = [
  { icon: ClipboardList, title: "Search & compare", body: "Filter by city, dates, transmission or budget and compare real listings from verified rental shops." },
  { icon: CalendarCheck, title: "Request to book", body: "Send a request with your dates — the shop confirms availability, then you pay securely to lock it in." },
  { icon: KeyRound, title: "Pick up & go", body: "Collect from the rental shop, do a quick handover check, and drive off. Return it the same way." },
];

/** The 3-step grid, reused inline on the homepage and as the body of the dedicated /how-it-works page — the caller supplies its own heading/wrapper. */
export function HowItWorksSection() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
      {STEPS.map(({ icon: Icon, title, body }, i) => (
        // phones: icon beside the text; sm+: stacked card
        <div key={title} className="relative flex gap-3.5 rounded-2xl border bg-card p-4 shadow-sm sm:block sm:p-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground sm:mt-4 sm:text-xs">STEP {i + 1}</p>
            <h3 className="mt-0.5 font-semibold sm:mt-1">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-1.5">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
