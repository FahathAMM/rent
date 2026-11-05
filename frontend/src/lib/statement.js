/**
 * A booking's payments are a customer account statement (see the backend
 * Payment model): debit = owed more (the booking charge, a price increase,
 * money paid back), credit = owed less (money received, a price decrease,
 * the charge reversed on cancellation), balance = still owed afterwards.
 * Money lines have a method (cash / bank); charge and adjustment lines don't.
 * At return the deposit is settled with three lines: "deposit_release" (credit,
 * the deposit charge closed), "damage" (debit, the part kept — reason in note)
 * and a cash "security_deposit" debit (what was handed back).
 */

export const isMoneyLine = (p) => p.method === "cash" || p.method === "bank";

/** Signed effect on what the customer owes: + debit, − credit. */
export const lineDelta = (p) => Number(p.debit ?? 0) - Number(p.credit ?? 0);

/**
 * Totals for a booking's statement. Only lines that took effect (succeeded)
 * count; receipts still waiting for the shop are reported separately.
 */
export function statementSummary(payments = []) {
  const done = payments.filter((p) => p.status === "succeeded");
  const sum = (lines, key) => lines.reduce((s, p) => s + Number(p[key] ?? 0), 0);
  const charges = done.filter((p) => !isMoneyLine(p));
  const money = done.filter(isMoneyLine);
  const pending = payments.filter((p) => isMoneyLine(p) && p.status === "pending");

  const rental = sum(charges.filter((p) => p.type === "booking_charge"), "debit");
  // The deposit still held as a charge: owed at confirmation, less what was settled at return.
  const deposit = sum(charges.filter((p) => p.type === "security_deposit"), "debit") - sum(charges.filter((p) => p.type === "deposit_release"), "credit");
  const damage = sum(charges.filter((p) => p.type === "damage"), "debit");
  const adjustments = sum(charges.filter((p) => p.type === "adjustment"), "debit") - sum(charges.filter((p) => p.type === "adjustment"), "credit");
  const charged = rental + deposit + damage + adjustments;
  const received = sum(money, "credit");
  const paidBack = sum(money, "debit");

  return {
    rental, deposit, damage, adjustments, charged, received, paidBack,
    balance: charged - received + paidBack,
    pendingCount: pending.length,
    pendingAmount: sum(pending, "credit"),
    lines: payments.length,
  };
}

/** Short label for a statement line. */
export function lineLabel(p) {
  if (p.type === "booking_charge") return "Booking charge";
  if (p.type === "security_deposit" && !isMoneyLine(p)) return "Security deposit (refundable)";
  if (p.type === "adjustment") return Number(p.debit) > 0 ? "Charge increased" : "Charge reduced";
  if (p.type === "deposit_release") return "Deposit settled at return";
  if (p.type === "damage") return p.note ? `Kept from deposit — ${p.note}` : "Kept from deposit for damage";
  const what = p.method === "bank" ? "Bank transfer" : "Cash";
  if (p.type === "security_deposit") return Number(p.debit) > 0 ? `${what} paid back · deposit` : `${what} · deposit`;
  return Number(p.debit) > 0 ? `${what} paid back` : `${what} received`;
}
