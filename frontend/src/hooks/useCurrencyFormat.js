"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/authStore";

/**
 * Formats an amount in the current tenant's own currency (Company.currency,
 * default AED) — used across CRM/Sales/Invoicing.
 */
export function useCompanyCurrencyFormat() {
  const { user } = useAuthStore();
  const currency = user?.company?.currency || "AED";

  return useCallback(
    (amount) => {
      try {
        return new Intl.NumberFormat("en-AE", { style: "currency", currency }).format(amount ?? 0);
      } catch {
        return `${currency} ${Number(amount ?? 0).toFixed(2)}`;
      }
    },
    [currency]
  );
}
