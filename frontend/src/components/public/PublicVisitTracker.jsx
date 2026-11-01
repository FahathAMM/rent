"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { visitService } from "@/services/visitService";

/** Logs one visit per public page opened (backend: storage/logs/public_visit/<date>.log). */
export function PublicVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    visitService.track("public_visit");
  }, [pathname]);

  return null;
}
