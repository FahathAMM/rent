"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextInput, NumberInput, TextareaInput, CheckboxInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Loader2, Plus, Trash2 } from "lucide-react";

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
 */
export function InspectionDialog({ open, onOpenChange, title, allowDamages = false, onSubmit, loading }) {
  const [form, setForm] = useState({ odometer_reading: "", fuel_level: "", notes: "", customer_present: true });
  const [damages, setDamages] = useState([]);
  const [errors, setErrors] = useState({});

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
    if (allowDamages && damages.length) {
      payload.damages = damages.map((d) => ({ ...d, estimated_cost: d.estimated_cost || undefined }));
    }
    onSubmit(payload, setErrors);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
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
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
