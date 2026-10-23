import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }) {
  const variants = {
    active: "success",
    inactive: "secondary",
    completed: "success",
    cancelled: "destructive",
    true: "success",
    false: "secondary",
    pending: "warning",
    approved: "info",
    rejected: "destructive",
    received: "success",
    paid: "success",
    partial: "warning",
    unpaid: "secondary",
  };

  const labels = {
    active: "Active",
    inactive: "Inactive",
    completed: "Completed",
    cancelled: "Cancelled",
    true: "Active",
    false: "Inactive",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    received: "Received",
    paid: "Paid",
    partial: "Partial",
    unpaid: "Unpaid",
  };

  const key = String(status === true ? "true" : status === false ? "false" : status);

  return <Badge variant={variants[key] ?? "outline"} className={cn(className)}>{labels[key] ?? status}</Badge>;
}
