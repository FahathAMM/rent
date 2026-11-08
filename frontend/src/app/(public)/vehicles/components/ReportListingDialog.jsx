"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { reportService } from "@/services/reportService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TextareaInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const REPORT_REASONS = ["misleading_price", "fake_listing", "unsafe_vehicle", "inappropriate_content", "fraud", "other"];

export function ReportListingDialog({ open, onOpenChange, vehicle }) {
  const t = useTranslations("report");
  const reasons = REPORT_REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }));
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const report = useMutation({
    mutationFn: () => reportService.create({ reportable_type: "vehicle", reportable_id: vehicle.id, reason, description }),
    onSuccess: () => {
      toast.success(t("submitted"));
      onOpenChange(false);
      setReason("");
      setDescription("");
    },
    onError: (err) => setError(err.response?.data?.message ?? t("failed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("title")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <SelectInput label={t("reason")} required options={reasons} value={reason} onChange={setReason} />
          <TextareaInput label={t("details")} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={() => report.mutate()} disabled={!reason || report.isPending}>
            {report.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
