import {
  ShoppingBag, Receipt, AlertTriangle, PackageSearch, TrendingUp, CalendarRange, Contact, PieChart,
} from "lucide-react";

// Single source of truth for both the /reports index cards and each
// /reports/[type] page — mirrors ReportService::TYPES on the backend.
export const REPORT_TYPES = [
  {
    value: "sales",
    label: "Sales Report",
    description: "Every sale with customer, totals, and payment status, for a date range.",
    icon: Receipt,
  },
  {
    value: "outstanding_sales",
    label: "Outstanding Receivables",
    description: "Sales still owed money by a customer, oldest first.",
    icon: AlertTriangle,
  },
  {
    value: "purchases",
    label: "Purchase Report",
    description: "Every purchase with vendor, totals, and payment status, for a date range.",
    icon: ShoppingBag,
  },
  {
    value: "expenses",
    label: "Expense Report",
    description: "Spend by category, for a date range.",
    icon: Receipt,
  },
  {
    value: "outstanding_purchases",
    label: "Outstanding Payables",
    description: "Purchases still owing money to a vendor, oldest first.",
    icon: AlertTriangle,
  },
  {
    value: "item_sales",
    label: "Item-wise Sales",
    description: "Total units sold and revenue per item, for a date range.",
    icon: PackageSearch,
  },
  {
    value: "profit_margin",
    label: "Profit / Margin",
    description: "Revenue, cost, and margin per item, for a date range.",
    icon: TrendingUp,
  },
  {
    value: "daily_sales",
    label: "Sales Summary",
    description: "Sales totals grouped by day or month, to spot trends.",
    icon: CalendarRange,
  },
  {
    value: "customer_ledger",
    label: "Customer Ledger",
    description: "Total purchased, paid, and outstanding balance per customer.",
    icon: Contact,
  },
  {
    value: "expense_by_category",
    label: "Expense by Category",
    description: "Spend by category, grouped by day or month, to spot trends.",
    icon: PieChart,
  },
];

export const reportTypeConfig = (type) => REPORT_TYPES.find((r) => r.value === type);
