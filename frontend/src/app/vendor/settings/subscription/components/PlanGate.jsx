"use client";

import Link from "next/link";
import { Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "./useSubscription";

const FEATURE_LABELS = { calendar: "The availability calendar", expenses: "Expenses", staff: "Staff & roles", sales: "Vehicle sales", reports: "Business reports" };

/**
 * Wraps a vendor page whose feature depends on the plan (used from each
 * route's layout.jsx). The API refuses these anyway (plan.feature
 * middleware); this just shows an upgrade card instead of empty errors.
 */
export function PlanGate({ feature, children }) {
  const { data, isLoading, isError } = useSubscription();

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  // If the summary can't load, let the page try — the API still enforces the plan.
  if (isError || !data || data.features?.includes(feature)) return children;

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <div className="rounded-full bg-amber-500/10 p-4"><Crown className="h-8 w-8 text-amber-600" /></div>
      <div>
        <h2 className="text-xl font-semibold">Upgrade to use this</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {FEATURE_LABELS[feature] ?? "This feature"} isn&apos;t included in your {data.plan?.name} plan.
        </p>
      </div>
      <Button asChild size="sm"><Link href="/vendor/settings/subscription">See plans</Link></Button>
    </div>
  );
}
