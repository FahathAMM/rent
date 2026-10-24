"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "damage", label: "Damage charge dispute" },
  { value: "no_show", label: "No-show" },
  { value: "overcharge", label: "Overcharge" },
  { value: "vehicle_condition", label: "Vehicle condition" },
  { value: "refund", label: "Refund" },
  { value: "late_return", label: "Late return" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

export function RaiseDisputeDialog({ open, onOpenChange, onSubmit, loading, againstSideOptions }) {
  const [form, setForm] = useState({ against_side: "", category: "", subject: "", description: "", claimed_amount: "" });
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    onSubmit({ ...form, claimed_amount: form.claimed_amount || undefined }, setErrors);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Raise a Dispute</DialogTitle>
          <DialogDescription>Our support team will review and help resolve this.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <ValidationError errors={errors} />
          <SelectInput
            label="This dispute is against"
            required
            value={form.against_side}
            onChange={(v) => setForm({ ...form, against_side: v })}
            options={againstSideOptions}
            error={errors.against_side?.[0]}
          />
          <SelectInput
            label="Category"
            required
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={CATEGORIES}
            error={errors.category?.[0]}
          />
          <TextInput label="Subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} error={errors.subject?.[0]} />
          <TextareaInput label="Description" required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description?.[0]} />
          <TextInput label="Claimed amount (optional)" type="number" value={form.claimed_amount} onChange={(e) => setForm({ ...form, claimed_amount: e.target.value })} error={errors.claimed_amount?.[0]} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Dispute
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
