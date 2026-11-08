"use client";

import { PlanGate } from "@/app/vendor/settings/subscription/components/PlanGate";

/** Vehicle sales is a plan feature — see PlanGate. */
export default function SalesLayout({ children }) {
  return <PlanGate feature="sales">{children}</PlanGate>;
}
