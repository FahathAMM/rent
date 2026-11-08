import Link from "next/link";
import { HelpPageHero } from "@/components/public/HelpPageHero";
import { SupportContactDetails } from "@/components/public/SupportContactDetails";
import { ArrowRight, CalendarRange, CircleHelp, Flag, MessageCircle, Store } from "lucide-react";

const TOPICS = [
  {
    icon: CalendarRange,
    title: "A problem with a booking",
    body: "Raise a dispute from your account and our team will review it.",
    href: "/account/disputes",
    cta: "Go to Disputes",
  },
  {
    icon: MessageCircle,
    title: "A question for a shop",
    body: "Open the vehicle's page and contact the shop directly, whether you are renting or buying.",
    href: "/rent",
    cta: "Find a vehicle",
  },
  {
    icon: Flag,
    title: "A suspicious listing",
    body: "Open the vehicle's page and choose Report this listing.",
    href: "/stay-safe",
    cta: "See warning signs",
  },
  {
    icon: Store,
    title: "Listing your business",
    body: "Register your shop and upload your business registration.",
    href: "/vendor/register",
    cta: "Register your shop",
  },
  {
    icon: CircleHelp,
    title: "Anything else",
    body: "Find answers about booking, payments and cancellations.",
    href: "/faq",
    cta: "Read the FAQ",
  },
];

export default function ContactPage() {
  return (
    <div>
      <HelpPageHero
        title="Contact us"
        description="Choose what you need help with, and we'll point you to the quickest way to sort it out."
      />

      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map(({ icon: Icon, title, body, href, cta }) => (
            <Link key={title} href={href} className="group flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-colors hover:border-primary/50">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <SupportContactDetails />
    </div>
  );
}
