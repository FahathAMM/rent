import { Handshake, MessageCircle, Search } from "lucide-react";

const STEPS = [
  { icon: Search, title: "Find your vehicle", body: "Filter by price, mileage, condition or location and compare vehicles for sale from verified shops." },
  { icon: MessageCircle, title: "Ask the shop", body: "Log in and send your question. The shop replies in your account under Enquiries, where you can arrange a time to see the vehicle." },
  { icon: Handshake, title: "See it & pay at the shop", body: "Check the vehicle in person, then pay the shop directly. Nothing is paid online. The shop gives you a sale agreement." },
];

/** The buying steps on /how-it-works, in the same style as the renting steps. */
export function HowBuyingWorks() {
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
