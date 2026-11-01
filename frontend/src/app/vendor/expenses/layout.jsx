"use client";

import { PlanGate } from "@/app/vendor/settings/subscription/components/PlanGate";

/** Expenses is a plan feature — see PlanGate. */
export default function ExpensesPlanLayout({ children }) {
  return <PlanGate feature="expenses">{children}</PlanGate>;
}
