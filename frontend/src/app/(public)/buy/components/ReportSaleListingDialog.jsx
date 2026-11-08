"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { reportService } from "@/services/reportService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TextareaInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const REPORT_REASONS = [
  { value: "misleading_price", label: "Misleading price" },
  { value: "fake_listing", label: "Fake listing" },
  { value: "unsafe_vehicle", label: "Unsafe vehicle" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

export function ReportSaleListingDialog({ open, onOpenChange, vehicle }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const report = useMutation({
    mutationFn: () => reportService.create({ reportable_type: "vehicle", reportable_id: vehicle.id, reason, description }),
    onSuccess: () => {
      toast.success("Report submitted — our team will review it");
      onOpenChange(false);
      setReason("");
      setDescription("");
    },
    onError: (err) => setError(err.response?.data?.message ?? "Failed to submit report"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Report this listing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <SelectInput label="Reason" required options={REPORT_REASONS} value={reason} onChange={setReason} />
          <TextareaInput label="Details (optional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={() => report.mutate()} disabled={!reason || report.isPending}>
            {report.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
