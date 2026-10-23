"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { purchaseService } from "@/services/purchaseService";
import { vendorService } from "@/services/vendorService";
import { itemService } from "@/services/itemService";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { Button } from "@/components/ui/button";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import { Fieldset } from "@/components/forms/Fieldset";
import { AttachmentPanel } from "@/components/shared/AttachmentPanel";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "received", label: "Received" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

const DISCOUNT_TYPES = [
  { value: "", label: "No discount" },
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage", label: "Percentage" },
];

const blankLine = () => ({
  key: Math.random().toString(36).slice(2),
  item_id: "",
  description: "",
  quantity: "1",
  unit_price: "0",
  discount_type: "",
  discount_value: "0",
  tax_rate: "0",
});

const defaultForm = {
  vendor_id: "",
  purchase_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  reference_no: "",
  status: "received",
  discount_type: "",
  discount_value: "0",
  paid_amount: "0",
  notes: "",
};

// Mirrors App\Support\DocumentTotals — client-side preview only; the server
// recomputes authoritatively on save.
function lineTotals(line) {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unit_price) || 0;
  const subtotal = round2(qty * price);
  const discount = discountAmount(line.discount_type, Number(line.discount_value) || 0, subtotal);
  const taxable = round2(subtotal - discount);
  const tax = round2(taxable * ((Number(line.tax_rate) || 0) / 100));
  return { subtotal, discount_amount: discount, taxable_amount: taxable, tax_amount: tax, total: round2(taxable + tax) };
}

function headerTotals(lines, discountType, discountValue) {
  const rows = lines.map(lineTotals);
  const subtotal = round2(sum(rows, "subtotal"));
  const lineDiscounts = round2(sum(rows, "discount_amount"));
  const lineTaxable = round2(sum(rows, "taxable_amount"));
  const lineTax = round2(sum(rows, "tax_amount"));

  const extraDiscount = discountAmount(discountType, Number(discountValue) || 0, lineTaxable);
  const discountAmt = round2(lineDiscounts + extraDiscount);
  const taxable = round2(lineTaxable - extraDiscount);
  const effectiveRate = lineTaxable > 0 ? lineTax / lineTaxable : 0;
  const tax = round2(taxable * effectiveRate);

  return { subtotal, discount_amount: discountAmt, tax_amount: tax, total: round2(taxable + tax) };
}

function discountAmount(type, value, base) {
  if (!type || value <= 0 || base <= 0) return 0;
  return type === "percentage" ? round2((base * value) / 100) : round2(Math.min(value, base));
}
function sum(rows, key) { return rows.reduce((acc, r) => acc + r[key], 0); }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function initialFormFor(purchase) {
  if (!purchase) return defaultForm;
  return {
    vendor_id: String(purchase.vendor_id),
    purchase_date: purchase.purchase_date?.slice(0, 10) ?? "",
    due_date: purchase.due_date?.slice(0, 10) ?? "",
    reference_no: purchase.reference_no ?? "",
    status: purchase.status,
    discount_type: purchase.discount_type ?? "",
    discount_value: purchase.discount_value ?? "0",
    paid_amount: purchase.paid_amount ?? "0",
    notes: purchase.notes ?? "",
  };
}

function initialLinesFor(purchase) {
  if (!purchase?.items?.length) return [blankLine()];
  return purchase.items.map((line) => ({
    key: Math.random().toString(36).slice(2),
    item_id: line.item_id ? String(line.item_id) : "",
    description: line.description,
    quantity: String(line.quantity),
    unit_price: String(line.unit_price),
    discount_type: line.discount_type ?? "",
    discount_value: String(line.discount_value ?? 0),
    tax_rate: String(line.tax_rate ?? 0),
  }));
}

export function PurchaseForm({ editing, onSaved, onCancel }) {
  const [form, setForm] = useState(() => initialFormFor(editing));
  const [lines, setLines] = useState(() => initialLinesFor(editing));
  const [errors, setErrors] = useState({});

  const { data: vendors } = useQuery({
    queryKey: ["vendors-lite"],
    queryFn: () => vendorService.getAll({ perPage: 100 }).then((r) => r.data.record.data),
  });
  const { data: items } = useQuery({
    queryKey: ["items-lite"],
    queryFn: () => itemService.getAll({ perPage: 200 }).then((r) => r.data.record.data),
  });

  const create = useMutation({
    mutationFn: purchaseService.create,
    onSuccess: () => { toast.success("Purchase created"); onSaved(); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });
  const update = useMutation({
    mutationFn: ({ id, data }) => purchaseService.update(id, data),
    onSuccess: () => { toast.success("Purchase updated"); onSaved(); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));
  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const addLine = () => setLines((p) => [...p, blankLine()]);
  const removeLine = (key) => setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p));
  const updateLine = (key, patch) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const pickItem = (key, itemId) => {
    const item = (items ?? []).find((i) => String(i.id) === itemId);
    updateLine(key, {
      item_id: itemId,
      description: item?.name ?? "",
      unit_price: item?.effective_purchase_price ? String(item.effective_purchase_price) : "0",
      tax_rate: item?.tax_rate ? String(item.tax_rate) : "0",
    });
  };

  const totals = useMemo(() => headerTotals(lines, form.discount_type, form.discount_value), [lines, form.discount_type, form.discount_value]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      vendor_id: form.vendor_id,
      purchase_date: form.purchase_date,
      due_date: form.due_date || null,
      reference_no: form.reference_no || null,
      status: form.status,
      discount_type: form.discount_type || null,
      discount_value: form.discount_value || 0,
      paid_amount: form.paid_amount || 0,
      notes: form.notes || null,
      items: lines.map((l) => ({
        item_id: l.item_id || null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_type: l.discount_type || null,
        discount_value: l.discount_value || 0,
        tax_rate: l.tax_rate || 0,
      })),
    };

    if (editing) update.mutate({ id: editing.id, data: payload });
    else create.mutate(payload);
  };

  const vendorOptions = (vendors ?? []).map((v) => ({ value: String(v.id), label: v.name }));
  const itemOptions = [{ value: "", label: "Custom line (no product)" }, ...(items ?? []).map((i) => ({ value: String(i.id), label: i.name }))];

  const isPending = create.isPending || update.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ValidationError errors={errors} />

      <Fieldset legend="Details" grid="grid-cols-2 lg:grid-cols-3">
        <SelectInput label="Vendor" value={form.vendor_id} onChange={f("vendor_id")} options={vendorOptions} placeholder="Select vendor" required error={errors.vendor_id?.[0]} />
        <DatePicker label="Purchase Date" value={form.purchase_date} onChange={f("purchase_date")} required error={errors.purchase_date?.[0]} />
        <DatePicker label="Due Date" value={form.due_date} onChange={f("due_date")} error={errors.due_date?.[0]} />
        <TextInput label="Reference No." value={form.reference_no} onChange={fi("reference_no")} placeholder="Supplier invoice #" error={errors.reference_no?.[0]} />
        <SelectInput label="Status" value={form.status} onChange={f("status")} options={STATUS_OPTIONS} error={errors.status?.[0]} />
      </Fieldset>

      <Fieldset legend="Line Items" grid={false}>
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] font-medium text-muted-foreground px-1">
            <div className="col-span-3">Product</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-1">Qty</div>
            <div className="col-span-2">Unit Price</div>
            <div className="col-span-1">Tax %</div>
            <div className="col-span-1">Total</div>
            <div className="col-span-1" />
          </div>
          {lines.map((line) => {
            const t = lineTotals(line);
            return (
              <div key={line.key} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-12 md:col-span-3">
                  <SelectInput value={line.item_id} onChange={(v) => pickItem(line.key, v)} options={itemOptions} placeholder="Product" triggerClassName="h-8 text-xs" />
                </div>
                <div className="col-span-12 md:col-span-3">
                  <TextInput value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} placeholder="Description" required inputClassName="h-8 text-xs" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground md:hidden">Qty</span>
                  <TextInput type="number" step="0.01" min="0.01" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} inputClassName="h-8 text-xs" />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground md:hidden">Unit Price</span>
                  <TextInput type="number" step="0.01" min="0" value={line.unit_price} onChange={(e) => updateLine(line.key, { unit_price: e.target.value })} inputClassName="h-8 text-xs" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground md:hidden">Tax %</span>
                  <TextInput type="number" step="0.01" min="0" max="100" value={line.tax_rate} onChange={(e) => updateLine(line.key, { tax_rate: e.target.value })} inputClassName="h-8 text-xs" />
                </div>
                <div className="col-span-10 md:col-span-1">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground md:hidden">Total</span>
                  <div className="flex h-8 items-center text-xs font-medium">{t.total.toFixed(2)}</div>
                </div>
                <div className="col-span-2 md:col-span-1 flex h-8 items-center justify-end">
                  <ActionButton onClick={() => removeLine(line.key)} icon={Trash2} label="Remove line" className="text-destructive border-destructive/40 hover:bg-destructive/10" />
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="mt-1">
            <Plus className="h-3.5 w-3.5" /> Add Line
          </Button>
        </div>
      </Fieldset>

      <Fieldset legend="Totals" grid={4}>
        <SelectInput label="Header Discount" value={form.discount_type} onChange={f("discount_type")} options={DISCOUNT_TYPES} />
        <TextInput label="Discount Value" type="number" step="0.01" min="0" value={form.discount_value} onChange={fi("discount_value")} disabled={!form.discount_type} />
        <TextInput label="Paid Amount" type="number" step="0.01" min="0" value={form.paid_amount} onChange={fi("paid_amount")} error={errors.paid_amount?.[0]} />
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{totals.discount_amount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{totals.tax_amount.toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{totals.total.toFixed(2)}</span></div>
        </div>
      </Fieldset>

      <Fieldset legend="Notes" grid={1}>
        <TextareaInput label="Notes" value={form.notes} onChange={fi("notes")} error={errors.notes?.[0]} />
      </Fieldset>

      {editing && (
        <Fieldset legend="Supplier Invoice / Documents" grid={1}>
          <AttachmentPanel attachableType="purchase" attachableId={editing.id} />
        </Fieldset>
      )}

      <div className="sticky bottom-0 z-10 -mx-5 flex justify-end items-center gap-2 border-t bg-background px-5 py-2 sm:-mx-6 sm:px-6">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      </div>
    </form>
  );
}
