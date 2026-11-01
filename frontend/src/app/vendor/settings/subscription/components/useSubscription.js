"use client";

import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";

export const SUBSCRIPTION_SUMMARY_KEY = ["vendor-subscription-summary"];

/**
 * The shop's plan, state (trial | active | grace | unpaid), `locked` (unpaid = workspace closed),
 * dates, usage and features. Anyone in the shop can read it.
 */
export function useSubscription({ enabled = true } = {}) {
  return useQuery({
    queryKey: SUBSCRIPTION_SUMMARY_KEY,
    queryFn: () => vendorService.subscription.summary().then((r) => r.data.data),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

/** null limit = unlimited. */
export const limitLabel = (n) => (n === null || n === undefined ? "Unlimited" : String(n));
