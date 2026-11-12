/** Shared by the Accounts tabs — the values match PlatformExpense::CATEGORIES / PAYMENT_METHODS on the backend. */
export const EXPENSE_CATEGORIES = [
  { value: "hosting", label: "Hosting & servers" },
  { value: "domain", label: "Domain & SSL" },
  { value: "software", label: "Software & tools" },
  { value: "sms_email", label: "SMS & email" },
  { value: "marketing", label: "Marketing & ads" },
  { value: "salaries", label: "Salaries & staff" },
  { value: "office", label: "Office" },
  { value: "legal", label: "Legal & professional" },
  { value: "bank_charges", label: "Bank charges" },
  { value: "tax", label: "Tax" },
  { value: "other", label: "Other" },
];

export const PAYMENT_METHODS = [
  { value: "", label: "Not specified" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export const categoryLabel = (value) => EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value ?? "—";

export const ACCOUNTS_SUMMARY_KEY = "platform-accounts-summary";
