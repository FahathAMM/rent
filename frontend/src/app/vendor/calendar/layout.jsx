"use client";

import { PlanGate } from "@/app/vendor/settings/subscription/components/PlanGate";

/** The availability calendar is a plan feature — see PlanGate. */
export default function CalendarPlanLayout({ children }) {
  return <PlanGate feature="calendar">{children}</PlanGate>;
}
