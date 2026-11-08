"use client";

import { CheckboxInput, TextInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";

export const CONDITIONS = [
  { value: "used", label: "Used" },
  { value: "reconditioned", label: "Reconditioned" },
  { value: "brand_new", label: "Brand new" },
];

export const emptySale = { price: "", is_negotiable: false, mileage_km: "", condition: "used", owners_count: "", warranty_months: "" };

export const toSale = (s = {}) => ({
  price: s.price ?? "",
  is_negotiable: !!s.is_negotiable,
  mileage_km: s.mileage_km ?? "",
  condition: s.condition ?? "used",
  owners_count: s.owners_count ?? "",
  warranty_months: s.warranty_months ?? "",
});

/** Blank optional numbers go to the API as null. */
export const salePayload = (sale) => ({
  ...sale,
  owners_count: sale.owners_count === "" ? null : sale.owners_count,
  warranty_months: sale.warranty_months === "" ? null : sale.warranty_months,
});

/** The sale-only fields — used by the listing form and by "Move to sale". */
export function SaleFields({ sale, onChange, errors = {} }) {
  const set = (key) => (e) => onChange({ ...sale, [key]: e.target.value });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextInput label="Asking price (LKR)" type="number" min="1" step="0.01" required value={sale.price} onChange={set("price")} error={errors.price?.[0]} />
      <SelectInput label="Condition" required value={sale.condition} onChange={(v) => onChange({ ...sale, condition: v })} options={CONDITIONS} error={errors.condition?.[0]} />
      <TextInput label="Mileage (km)" type="number" min="0" required value={sale.mileage_km} onChange={set("mileage_km")} error={errors.mileage_km?.[0]} />
      <TextInput label="Previous owners" type="number" min="0" value={sale.owners_count} onChange={set("owners_count")} error={errors.owners_count?.[0]} />
      <TextInput label="Warranty (months)" type="number" min="0" value={sale.warranty_months} onChange={set("warranty_months")} error={errors.warranty_months?.[0]} />
      <CheckboxInput label="Price is negotiable" checked={sale.is_negotiable} onChange={(v) => onChange({ ...sale, is_negotiable: !!v })} />
    </div>
  );
}
