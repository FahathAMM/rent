"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { visitService } from "@/services/visitService";

/**
 * Logs one visit per vendor app page a signed-in owner/staff member opens
 * — the vendor counterpart of PublicVisitTracker. Shown on /platform/visits.
 */
export function VendorVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    visitService.trackVendor();
  }, [pathname]);

  return null;
}
