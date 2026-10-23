"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { purchaseService } from "@/services/purchaseService";
import { Modal } from "@/components/Elements/Modal";
import { Button } from "@/components/ui/button";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  { value: "", label: "Not specified" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const defaultForm = {
  amount: "",
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: "",
  reference_no: "",
  notes: "",
};

export function RecordPaymentDialog({ open, onOpenChange, purchase, onRecorded }) {
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  const record = useMutation({
    mutationFn: () => purchaseService.recordPayment(purchase.id, form),
    onSuccess: () => {
      toast.success("Payment recorded");
      setForm(defaultForm);
      setErrors({});
      onRecorded();
      onOpenChange(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));
  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const close = () => {
    onOpenChange(false);
    setForm(defaultForm);
    setErrors({});
  };

  return (
    <Modal open={open} onOpenChange={close} title={`Record Payment — ${purchase?.purchase_number ?? ""}`} size="md" headerBorder>
      <div className="space-y-4 pb-4">
        <ValidationError errors={errors} />
        <p className="text-xs text-muted-foreground">
          Balance due: <span className="font-semibold text-foreground">{Number(purchase?.balance_amount ?? 0).toFixed(2)}</span>
        </p>
        <TextInput
          label="Amount"
          type="number"
          step="0.01"
          min="0.01"
          max={purchase?.balance_amount}
          value={form.amount}
          onChange={fi("amount")}
          error={errors.amount?.[0]}
          required
        />
        <DatePicker label="Payment Date" value={form.payment_date} onChange={f("payment_date")} error={errors.payment_date?.[0]} required />
        <SelectInput label="Payment Method" value={form.payment_method} onChange={f("payment_method")} options={PAYMENT_METHODS} error={errors.payment_method?.[0]} />
        <TextInput label="Reference No." value={form.reference_no} onChange={fi("reference_no")} error={errors.reference_no?.[0]} />
        <TextareaInput label="Notes" value={form.notes} onChange={fi("notes")} error={errors.notes?.[0]} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={close}>Cancel</Button>
          <Button
            type="button"
            size="sm"
            disabled={record.isPending || !form.amount || Number(form.amount) <= 0}
            onClick={() => record.mutate()}
          >
            {record.isPending ? "Recording..." : "Record"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
