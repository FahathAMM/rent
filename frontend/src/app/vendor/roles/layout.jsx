"use client";

import { PlanGate } from "@/app/vendor/settings/subscription/components/PlanGate";

/** Shop roles is a plan feature — see PlanGate. */
export default function RolesPlanLayout({ children }) {
  return <PlanGate feature="staff">{children}</PlanGate>;
}
