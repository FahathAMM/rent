"use client";

import { useCallback } from "react";

/**
 * The marketplace is LKR-only (see app-doc/marketplace/02-data-model.md:
 * "currency is char(3) fixed to LKR") — unlike the old per-tenant
 * Company.currency this replaced, there is no per-user setting here.
 */
export function useCurrencyFormat() {
  const format = useCallback((amount) => {
    try {
      return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(amount ?? 0);
    } catch {
      return `LKR ${Number(amount ?? 0).toFixed(0)}`;
    }
  }, []);

  return { format };
}
