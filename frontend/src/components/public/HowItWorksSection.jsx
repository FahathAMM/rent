import { ClipboardList, CalendarCheck, KeyRound } from "lucide-react";

const STEPS = [
  { icon: ClipboardList, title: "Search & compare", body: "Filter by city, dates, transmission or budget and compare real listings from verified rental shops." },
  { icon: CalendarCheck, title: "Request to book", body: "Send a request with your dates — the shop confirms availability, then you pay securely to lock it in." },
  { icon: KeyRound, title: "Pick up & go", body: "Collect from the rental shop, do a quick handover check, and drive off. Return it the same way." },
];

/** The 3-step grid, reused inline on the homepage and as the body of the dedicated /how-it-works page — the caller supplies its own heading/wrapper. */
export function HowItWorksSection() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {STEPS.map(({ icon: Icon, title, body }, i) => (
        <div key={title} className="relative rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">STEP {i + 1}</p>
          <h3 className="mt-1 font-semibold">{title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  );
}
