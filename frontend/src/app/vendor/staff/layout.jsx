"use client";

import { PlanGate } from "@/app/vendor/settings/subscription/components/PlanGate";

/** Staff management is a plan feature — see PlanGate. */
export default function StaffPlanLayout({ children }) {
  return <PlanGate feature="staff">{children}</PlanGate>;
}
