import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }) {
  const variants = {
    active: "success",
    inactive: "secondary",
    suspended: "warning",
    banned: "destructive",
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
    draft: "secondary",
    submitted: "warning",
    info_requested: "warning",
    verified: "success",
    unverified: "secondary",
    pending_review: "warning",
    flagged: "destructive",
    published: "success",
    unpublished: "secondary",
    archived: "secondary",
  };

  const labels = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    banned: "Banned",
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
    draft: "Draft",
    submitted: "Submitted",
    info_requested: "Info Requested",
    verified: "Verified",
    unverified: "Unverified",
    pending_review: "Pending Review",
    flagged: "Flagged",
    published: "Published",
    unpublished: "Unpublished",
    archived: "Archived",
  };

  const key = String(status === true ? "true" : status === false ? "false" : status);

  return <Badge variant={variants[key] ?? "outline"} className={cn(className)}>{labels[key] ?? status}</Badge>;
}
