"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextInput, NumberInput, TextareaInput, CheckboxInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Banknote, Loader2, Plus, ScrollText, ShieldCheck, Trash2 } from "lucide-react";
import { SignaturePad } from "./SignaturePad";

const FUEL_LEVELS = [
  { value: "empty", label: "Empty" },
  { value: "quarter", label: "1/4" },
  { value: "half", label: "1/2" },
  { value: "three_quarter", label: "3/4" },
  { value: "full", label: "Full" },
];

const SEVERITIES = [
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "major", label: "Major" },
];

const emptyDamage = { area: "", description: "", severity: "minor", estimated_cost: "" };

/**
 * Shared by handover (confirmed -> active) and return (active ->
 * completed) - the only difference is whether damages can be reported
 * (return only) and the submit label/handler the caller passes in.
 *
 * cashDue (handover): cash the shop must take before the keys go out — staff confirm it.
 * depositHeld (return): a cash deposit the shop holds — staff record what they keep, if anything.
 */
export function InspectionDialog({ open, onOpenChange, title, allowDamages = false, onSubmit, loading, cashDue = null, depositHeld = null, terms = null }) {
  const { format } = useCurrencyFormat();
  const [form, setForm] = useState({
    odometer_reading: "", fuel_level: "", notes: "", customer_present: true,
    cash_received: false, deposit_deduction: "", deposit_deduction_reason: "",
  });
  const [damages, setDamages] = useState([]);
  // Handover with shop terms: the customer reads them, agrees and signs on screen.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signature, setSignature] = useState(null);
  const [errors, setErrors] = useState({});
  const deduction = Number(form.deposit_deduction || 0);

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const addDamage = () => setDamages((d) => [...d, { ...emptyDamage }]);
  const updateDamage = (i, key, value) => setDamages((d) => d.map((item, idx) => (idx === i ? { ...item, [key]: value } : item)));
  const removeDamage = (i) => setDamages((d) => d.filter((_, idx) => idx !== i));

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      odometer_reading: form.odometer_reading || undefined,
      fuel_level: form.fuel_level || undefined,
      notes: form.notes || undefined,
      customer_present: form.customer_present,
    };
    if (cashDue) payload.cash_received = form.cash_received;
    if (terms) {
      payload.terms_accepted = termsAccepted;
      payload.customer_signature = signature || undefined;
    }
    if (depositHeld) {
      payload.deposit_deduction = form.deposit_deduction || 0;
      payload.deposit_deduction_reason = form.deposit_deduction_reason || undefined;
    }
    if (allowDamages && damages.length) {
      payload.damages = damages.map((d) => ({ ...d, estimated_cost: d.estimated_cost || undefined }));
    }
    onSubmit(payload, setErrors);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Record the vehicle&apos;s condition.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ValidationError errors={errors} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Odometer Reading (km)" value={form.odometer_reading} onChange={fi("odometer_reading")} error={errors.odometer_reading?.[0]} />
            <SelectInput label="Fuel Level" value={form.fuel_level} onChange={f("fuel_level")} options={FUEL_LEVELS} error={errors.fuel_level?.[0]} />
          </div>
          <TextareaInput label="Notes" value={form.notes} onChange={fi("notes")} error={errors.notes?.[0]} />
          <CheckboxInput label="Customer present" checked={form.customer_present} onChange={f("customer_present")} />

          {cashDue > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="flex items-center gap-2 text-sm font-medium"><Banknote className="h-4 w-4" /> Collect {format(cashDue)} in cash</p>
              <CheckboxInput label={`I have received ${format(cashDue)} from the customer`} checked={form.cash_received} onChange={f("cash_received")} />
              {errors.cash_received?.[0] && <p className="text-xs text-destructive">{errors.cash_received[0]}</p>}
            </div>
          )}

          {terms && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="flex items-center gap-2 text-sm font-medium"><ScrollText className="h-4 w-4" /> Terms & conditions — the customer reads and signs</p>
              {/* Shop terms HTML — cleaned to plain formatting tags on the server. */}
              <div className="rich-text max-h-48 overflow-y-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: terms }} />
              <CheckboxInput label="The customer has read and agrees to these terms" checked={termsAccepted} onChange={(v) => setTermsAccepted(!!v)} />
              {errors.terms_accepted?.[0] && <p className="text-xs text-destructive">{errors.terms_accepted[0]}</p>}
              <SignaturePad onChange={setSignature} />
              {errors.customer_signature?.[0] && <p className="text-xs text-destructive">{errors.customer_signature[0]}</p>}
            </div>
          )}

          {depositHeld > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> Security deposit held: {format(depositHeld)}</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Amount kept (deduction)" value={form.deposit_deduction} onChange={fi("deposit_deduction")} error={errors.deposit_deduction?.[0]} />
                <TextInput label="Reason" value={form.deposit_deduction_reason} onChange={fi("deposit_deduction_reason")} disabled={!deduction} error={errors.deposit_deduction_reason?.[0]} />
              </div>
              <p className="text-sm">Return to customer: <span className="font-semibold">{format(Math.max(0, depositHeld - deduction))}</span></p>
            </div>
          )}

          {allowDamages && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Damages (optional)</p>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addDamage}>
                  <Plus className="h-3.5 w-3.5" /> Add Damage
                </Button>
              </div>
              {damages.map((damage, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 rounded-md border p-2">
                  <TextInput placeholder="Area (e.g. rear bumper)" value={damage.area} onChange={(e) => updateDamage(i, "area", e.target.value)} />
                  <TextInput placeholder="Description" value={damage.description} onChange={(e) => updateDamage(i, "description", e.target.value)} />
                  <SelectInput value={damage.severity} onChange={(v) => updateDamage(i, "severity", v)} options={SEVERITIES} className="w-28" />
                  <Button type="button" variant="outline" size="icon" className="text-destructive" onClick={() => removeDamage(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || (cashDue > 0 && !form.cash_received) || (!!terms && (!termsAccepted || !signature))}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
