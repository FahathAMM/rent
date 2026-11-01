"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Crown } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useSubscription } from "./useSubscription";

/**
 * A thin strip above every vendor page when the plan needs attention: trial
 * ending (≤ 7 days) or a paid plan in its grace period. (An unpaid shop gets
 * the full SubscriptionLock screen instead.) Hidden on the Subscription page.
 */
export function PlanBanner() {
  const pathname = usePathname();
  const { data } = useSubscription();
  if (!data || pathname.startsWith("/vendor/settings/subscription")) return null;

  const plan = data.plan ?? {};
  let tone = "amber";
  let text = null;

  if (data.state === "trial" && data.days_left <= 7) {
    text = data.days_left > 0
      ? `Your ${plan.name} trial ends in ${data.days_left} day${data.days_left === 1 ? "" : "s"}. Choose a plan to keep its features.`
      : `Your ${plan.name} trial ends today.`;
    text += " After that the vendor workspace closes until a plan is paid for.";
  } else if (data.state === "grace") {
    tone = "red";
    text = `Your ${plan.name} plan ended on ${formatDateTime(data.ends_at)}. Renew by ${formatDateTime(data.grace_ends_at)} or the vendor workspace closes.`;
  }
  if (!text) return null;

  return (
    <div className={tone === "red"
      ? "flex flex-wrap items-center justify-between gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-800 dark:text-red-300"
      : "flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-300"}
    >
      <p className="flex items-center gap-2">
        {tone === "red" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Crown className="h-4 w-4 shrink-0" />}
        {text}
      </p>
      <Link href="/vendor/settings/subscription" className="font-medium underline">View plans</Link>
    </div>
  );
}
