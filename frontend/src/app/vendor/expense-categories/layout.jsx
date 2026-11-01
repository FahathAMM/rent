"use client";

import { PlanGate } from "@/app/vendor/settings/subscription/components/PlanGate";

/** Expense categories is a plan feature — see PlanGate. */
export default function ExpenseCategoriesPlanLayout({ children }) {
  return <PlanGate feature="expenses">{children}</PlanGate>;
}
