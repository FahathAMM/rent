// Mirrors the backend's App\Support\DocumentTotals — for live preview only.
// The server always recomputes and is the source of truth; nothing here is trusted.

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function discountAmount(type, value, base) {
  if (!type || !value || value <= 0 || base <= 0) return 0;
  return type === "percentage" ? round2((base * value) / 100) : round2(Math.min(value, base));
}

export function calcLine(qty, unitPrice, discountType, discountValue, taxRate) {
  const subtotal = round2((Number(qty) || 0) * (Number(unitPrice) || 0));
  const discount = discountAmount(discountType, Number(discountValue) || 0, subtotal);
  const taxable = round2(subtotal - discount);
  const tax = round2((taxable * (Number(taxRate) || 0)) / 100);
  const total = round2(taxable + tax);
  return { subtotal, discount_amount: discount, taxable_amount: taxable, tax_amount: tax, total };
}

export function calcHeader(lines, discountType, discountValue) {
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const lineDiscounts = round2(lines.reduce((s, l) => s + l.discount_amount, 0));
  const lineTaxable = round2(lines.reduce((s, l) => s + l.taxable_amount, 0));
  const lineTax = round2(lines.reduce((s, l) => s + l.tax_amount, 0));

  const extraDiscount = discountAmount(discountType, Number(discountValue) || 0, lineTaxable);
  const discount = round2(lineDiscounts + extraDiscount);
  const taxable = round2(lineTaxable - extraDiscount);

  const effectiveRate = lineTaxable > 0 ? lineTax / lineTaxable : 0;
  const tax = round2(taxable * effectiveRate);
  const total = round2(taxable + tax);

  return { subtotal, discount_amount: discount, taxable_amount: taxable, tax_amount: tax, total };
}
