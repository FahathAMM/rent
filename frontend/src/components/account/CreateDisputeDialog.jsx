"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SelectInput } from "@/components/forms/SelectInput";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  ["damage", "Damage"], ["no_show", "No show"], ["overcharge", "Overcharge"],
  ["vehicle_condition", "Vehicle condition"], ["refund", "Refund"],
  ["late_return", "Late return"], ["fraud", "Fraud"], ["other", "Other"],
].map(([value, label]) => ({ value, label }));

const initial = { against_side: "owner", category: "other", subject: "", description: "", claimed_amount: "" };

export function CreateDisputeDialog({ booking, onClose }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () => customerService.disputes.create({
      ...form,
      booking_reference: booking.booking_reference,
      claimed_amount: form.claimed_amount || undefined,
    }),
    onSuccess: (res) => {
      const dispute = res.data.data;
      qc.invalidateQueries({ queryKey: ["my-disputes"] });
      qc.invalidateQueries({ queryKey: ["my-booking", booking.booking_reference] });
      toast.success("Dispute opened");
      onClose();
      router.push(`/account/disputes/${dispute.dispute_reference}`);
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {};
      setErrors(apiErrors);
      if (!Object.keys(apiErrors).length) toast.error(err.response?.data?.message ?? "Could not open the dispute");
    },
  });

  const error = (key) => errors[key]?.[0];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open a dispute</DialogTitle>
          <DialogDescription>Booking {booking.booking_reference}. Describe the issue clearly so the shop or platform team can help.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setErrors({}); create.mutate(); }}>
          <SelectInput label="Raise this with" value={form.against_side} onChange={set("against_side")} options={[{ value: "owner", label: "Shop" }, { value: "platform", label: "Platform team" }]} error={error("against_side")} />
          <SelectInput label="Issue type" value={form.category} onChange={set("category")} options={CATEGORIES} error={error("category")} />
          <div className="space-y-1.5"><Label htmlFor="dispute-subject">Subject</Label><Input id="dispute-subject" value={form.subject} onChange={(e) => set("subject")(e.target.value)} maxLength={255} required />{error("subject") && <p className="text-xs text-destructive">{error("subject")}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="dispute-description">What happened?</Label><Textarea id="dispute-description" value={form.description} onChange={(e) => set("description")(e.target.value)} maxLength={5000} rows={5} required placeholder="Include relevant details, dates, and what outcome you are requesting." />{error("description") && <p className="text-xs text-destructive">{error("description")}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="dispute-amount">Amount in dispute (optional)</Label><Input id="dispute-amount" type="number" min="0" step="0.01" value={form.claimed_amount} onChange={(e) => set("claimed_amount")(e.target.value)} />{error("claimed_amount") && <p className="text-xs text-destructive">{error("claimed_amount")}</p>}</div>
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={create.isPending || !form.subject.trim() || !form.description.trim()}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Open dispute</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
