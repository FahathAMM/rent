"use client";

import { PlanGate } from "@/app/vendor/settings/subscription/components/PlanGate";

/** Business reports are a plan feature (Pro / Business) — see PlanGate. */
export default function ReportsPlanLayout({ children }) {
  return <PlanGate feature="reports">{children}</PlanGate>;
}
