"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { itemService } from "@/services/itemService";
import { customerService } from "@/services/customerService";
import { saleService } from "@/services/saleService";
import { useCompanyCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Modal } from "@/components/Elements/Modal";
import { downloadBlob, cn } from "@/lib/utils";
import { getItemIcon } from "@/lib/itemIcons";
import { toast } from "sonner";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Wallet,
  CreditCard, Landmark, CheckCircle2, Download, RotateCcw,
  PackageSearch, Receipt, Printer, FileText,
} from "lucide-react";

const PAYMENT_LABELS = { cash: "Cash", card: "Card", bank_transfer: "Bank Transfer" };

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Wallet },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "bank_transfer", label: "Bank", icon: Landmark },
];

const CATEGORY_COLORS = [
  { bg: "bg-blue-50", text: "text-blue-600", solid: "bg-blue-600", dot: "bg-blue-500" },
  { bg: "bg-emerald-50", text: "text-emerald-600", solid: "bg-emerald-600", dot: "bg-emerald-500" },
  { bg: "bg-violet-50", text: "text-violet-600", solid: "bg-violet-600", dot: "bg-violet-500" },
  { bg: "bg-amber-50", text: "text-amber-600", solid: "bg-amber-600", dot: "bg-amber-500" },
  { bg: "bg-rose-50", text: "text-rose-600", solid: "bg-rose-600", dot: "bg-rose-500" },
  { bg: "bg-cyan-50", text: "text-cyan-600", solid: "bg-cyan-600", dot: "bg-cyan-500" },
];
const NEUTRAL_COLOR = { bg: "bg-slate-100", text: "text-slate-600", solid: "bg-slate-600", dot: "bg-slate-400" };

// Falls back to guessing from the category name only when the item itself
// has no icon chosen (Products form) — keeps old items looking right too.
const CATEGORY_ICON_RULES = [
  { match: /egg/i, icon: getItemIcon("egg") },
  { match: /suppl|packag|feed|bag|block/i, icon: getItemIcon("package") },
];
const NEUTRAL_ICON = getItemIcon("drumstick");

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function cartTotals(cart) {
  let subtotal = 0, tax = 0;
  cart.forEach((line) => {
    const lineSubtotal = round2(line.quantity * line.unit_price);
    const lineTax = round2(lineSubtotal * ((line.tax_rate || 0) / 100));
    subtotal += lineSubtotal;
    tax += lineTax;
  });
  subtotal = round2(subtotal);
  tax = round2(tax);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

/** Rounds a total up to the next "nice" cash amount for a one-tap quick-tender button (e.g. 47.50 -> 50). */
function quickTenderAmounts(total) {
  if (total <= 0) return [];
  const steps = [5, 10, 20, 50, 100];
  const amounts = new Set([round2(total)]);
  for (const step of steps) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) amounts.add(rounded);
    if (amounts.size >= 4) break;
  }
  return [...amounts].sort((a, b) => a - b).slice(0, 4);
}

function ProductTile({ item, color, Icon, formatCurrency, qty, onAdd }) {
  const selected = qty > 0;
  const unit = item.unit?.short_name || item.unit?.name || "unit";
  const hasPrice = item.effective_selling_price != null;

  return (
    <button
      type="button"
      disabled={!hasPrice}
      onClick={() => onAdd(item)}
      title={!hasPrice ? "No selling price set for this product" : undefined}
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl border bg-card p-3 text-left transition-all duration-150",
        hasPrice
          ? cn("hover:border-primary/40 hover:shadow-md active:scale-[0.97]", selected ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/30 shadow-sm" : "border-border shadow-sm")
          : "cursor-not-allowed border-dashed border-border bg-muted/30",
      )}
    >
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground shadow-sm ring-2 ring-card tabular-nums">
          {Number.isInteger(qty) ? qty : qty.toFixed(2)}
        </span>
      )}
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset transition-transform duration-150", hasPrice && "group-hover:scale-105", hasPrice ? cn(color.bg, color.text, "ring-black/5") : "bg-muted text-muted-foreground ring-transparent")}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className={cn("truncate text-sm font-semibold leading-tight", hasPrice ? "text-foreground" : "text-muted-foreground")} title={item.name}>{item.name}</p>
      <p className="mt-auto w-full truncate text-base font-bold tabular-nums text-foreground">
        {hasPrice ? (
          <>
            {formatCurrency(item.effective_selling_price)}
            <span className="ml-1 text-xs font-medium text-muted-foreground">/{unit}</span>
          </>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">No price set</span>
        )}
      </p>
    </button>
  );
}

function QtyInput({ value, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) && draft.trim() !== "" ? Math.max(0.01, parsed) : value;
    setDraft(String(next));
    if (next !== value) onCommit(round2(next));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={editing ? draft : String(value)}
      onFocus={(e) => {
        setEditing(true);
        setDraft(String(value));
        e.target.select();
      }}
      onChange={(e) => {
        const v = e.target.value;
        if (/^\d*\.?\d*$/.test(v)) setDraft(v);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
      }}
      className="h-7 w-12 bg-transparent text-center text-xs font-semibold tabular-nums outline-none"
    />
  );
}

/** Lets a cart line be entered as "Rs X worth" instead of a quantity — commits the raw amount, quantity is derived from it by the caller. */
function AmountInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && draft.trim() !== "" && parsed > 0) {
      if (draft !== value) onCommit(draft);
    } else {
      setDraft(value);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={editing ? draft : value}
      onFocus={(e) => {
        setEditing(true);
        setDraft(value);
        e.target.select();
      }}
      onChange={(e) => {
        const v = e.target.value;
        if (/^\d*\.?\d*$/.test(v)) setDraft(v);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
      }}
      className="h-7 w-16 bg-transparent text-center text-xs font-semibold tabular-nums outline-none"
    />
  );
}

function ReceiptSuccess({ sale, formatCurrency, onViewBill, onNewSale }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </span>
      </div>
      <div>
        <p className="text-lg font-bold text-foreground">Sale Complete</p>
        <p className="font-mono text-xs text-muted-foreground">{sale.sale_number}</p>
        <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">{formatCurrency(sale.total)}</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button size="lg" onClick={onNewSale} className="w-full bg-emerald-600 hover:bg-emerald-700">
          <RotateCcw className="h-4 w-4" />New Sale
        </Button>
        <Button variant="outline" onClick={onViewBill} className="w-full">
          <FileText className="h-4 w-4" />View / Print Bill
        </Button>
      </div>
    </div>
  );
}

/**
 * Receipt-styled preview of the just-completed sale. Printing uses the
 * browser's print dialog against #bill-print-area only (everything else is
 * hidden for that media query) so it works without a backend round-trip;
 * "Download PDF" reuses the existing formal invoice endpoint.
 */
function BillContent({ sale, company, payment, formatCurrency }) {
  const items = sale.items ?? [];
  const paymentLabel = PAYMENT_LABELS[payment?.method] ?? payment?.method ?? "";

  return (
    <>
      <div className="text-center">
        {company?.logo && <img src={company.logo} alt={company.name} className="mx-auto mb-1 h-10 object-contain" />}
        <p className="text-sm font-bold uppercase">{company?.name || "Company"}</p>
        {(company?.address_line_1 || company?.city) && (
          <p className="text-[10px]">{[company?.address_line_1, company?.city].filter(Boolean).join(", ")}</p>
        )}
        {company?.phone && <p className="text-[10px]">Tel: {company.phone}</p>}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between"><span>Bill No:</span><span>{sale.sale_number}</span></div>
        <div className="flex justify-between"><span>Date:</span><span>{String(sale.sale_date).slice(0, 10)}</span></div>
        <div className="flex justify-between"><span>Customer:</span><span className="max-w-[170px] truncate">{sale.customer_name}</span></div>
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id}>
            <p className="font-semibold leading-tight">{it.description}</p>
            <div className="flex justify-between text-[11px]">
              <span>{Number(it.quantity)} x {Number(it.unit_price).toFixed(2)}</span>
              <span>{Number(it.total).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between"><span>Subtotal</span><span>{Number(sale.subtotal).toFixed(2)}</span></div>
        {Number(sale.discount_amount) > 0 && (
          <div className="flex justify-between"><span>Discount</span><span>-{Number(sale.discount_amount).toFixed(2)}</span></div>
        )}
        <div className="flex justify-between"><span>Tax</span><span>{Number(sale.tax_amount).toFixed(2)}</span></div>
        <div className="flex justify-between border-t border-dashed border-black pt-1 text-sm font-bold">
          <span>TOTAL</span><span>{formatCurrency(sale.total)}</span>
        </div>
        <div className="flex justify-between"><span>Paid ({paymentLabel})</span><span>{formatCurrency(sale.paid_amount)}</span></div>
        {payment?.method === "cash" && payment?.change > 0 && (
          <div className="flex justify-between"><span>Change</span><span>{formatCurrency(payment.change)}</span></div>
        )}
      </div>

      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center text-[11px]">Thank you! Visit again.</p>
    </>
  );
}

/**
 * Receipt-styled preview of the just-completed sale. The on-screen copy lives
 * inside the Dialog for previewing; printing instead uses a SEPARATE copy
 * portaled straight onto <body> (id="bill-print-area") because Radix's Dialog
 * applies a CSS transform to its content for the open/close animation, which
 * creates a new containing block — a position:fixed element nested inside it
 * gets clipped to the dialog's own box instead of the viewport, so only
 * whatever fit in that box (the header) would print. Printing the portaled
 * copy avoids that ancestor entirely. "Download PDF" still just reuses the
 * existing backend invoice endpoint.
 */
function BillPreviewModal({ open, onOpenChange, sale, company, payment, formatCurrency, onDownload, downloading }) {
  if (!sale) return null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Bill Preview" size="sm" headerBorder>
      <style>{`
        #bill-print-area { display: none; }
        @media print {
          body * { visibility: hidden; }
          #bill-print-area { display: block; visibility: visible; position: fixed; inset: 0; width: 320px; margin: 0 auto; background: #fff; color: #000; font-family: monospace; font-size: 12px; padding: 8px 0; }
          #bill-print-area * { visibility: visible; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[320px] bg-white py-2 font-mono text-[12px] text-black">
        <BillContent sale={sale} company={company} payment={payment} formatCurrency={formatCurrency} />
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div id="bill-print-area">
          <BillContent sale={sale} company={company} payment={payment} formatCurrency={formatCurrency} />
        </div>,
        document.body
      )}

      <div className="sticky bottom-0 z-10 -mx-6 mt-4 flex items-center gap-2 border-t bg-background px-6 py-3">
        <Button variant="outline" className="flex-1" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />Print
        </Button>
        <Button className="flex-1" onClick={onDownload} disabled={downloading}>
          <Download className="h-4 w-4" />{downloading ? "Preparing..." : "Download PDF"}
        </Button>
      </div>
    </Modal>
  );
}

export default function PosPage() {
  const formatCurrency = useCompanyCurrencyFormat();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [completedSale, setCompletedSale] = useState(null);
  const [lastPayment, setLastPayment] = useState(null);
  const [billOpen, setBillOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["items-lite"],
    queryFn: () => itemService.getAll({ perPage: 200 }).then((r) => r.data.record.data),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers-lite"],
    queryFn: () => customerService.getAll({ perPage: 100 }).then((r) => r.data.record.data),
  });

  const checkout = useMutation({
    mutationFn: saleService.create,
    onSuccess: (res) => {
      setCompletedSale(res.data.data);
      setCart([]);
      setCustomerId("");
      setWalkInName("");
      setTendered("");
      toast.success("Sale completed");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to complete sale"),
  });

  const categories = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.category).filter(Boolean));
    return [...set];
  }, [items]);

  const colorForCategory = (cat) => {
    if (!cat) return NEUTRAL_COLOR;
    const idx = categories.indexOf(cat);
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] ?? NEUTRAL_COLOR;
  };

  const iconForItem = (item) => {
    const chosen = getItemIcon(item.icon);
    if (chosen) return chosen;
    if (!item.category) return NEUTRAL_ICON;
    return CATEGORY_ICON_RULES.find((rule) => rule.match.test(item.category))?.icon ?? NEUTRAL_ICON;
  };

  const activeItems = useMemo(() => (items ?? []).filter((i) => i.is_active), [items]);

  const cartQtyByItemId = useMemo(() => {
    const map = new Map();
    cart.forEach((l) => map.set(l.item_id, l.quantity));
    return map;
  }, [cart]);

  const filteredItems = useMemo(() => {
    return activeItems.filter((i) => {
      if (category && i.category !== category) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [activeItems, category, search]);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.item_id === item.id);
      if (existing) {
        return prev.map((l) => {
          if (l.item_id !== item.id) return l;
          const quantity = round2(l.quantity + 1);
          return { ...l, quantity, amount: l.byAmount ? String(round2(quantity * l.unit_price)) : l.amount };
        });
      }
      return [...prev, {
        key: item.id,
        item_id: item.id,
        name: item.name,
        unit: item.unit?.short_name || item.unit?.name || "",
        unit_price: Number(item.effective_selling_price) || 0,
        tax_rate: Number(item.tax_rate) || 0,
        quantity: 1,
        byAmount: false,
        amount: "",
      }];
    });
  };

  const updateQty = (key, quantity) => {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(0.01, quantity) } : l)));
  };

  /** Cashier typed "Rs X worth" instead of a weight — back-solve the quantity from it. */
  const updateAmount = (key, amountStr) => {
    setCart((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const amount = Number(amountStr) || 0;
      const quantity = l.unit_price > 0 ? Math.max(0.01, round2(amount / l.unit_price)) : l.quantity;
      return { ...l, amount: amountStr, quantity };
    }));
  };

  const toggleLineMode = (key) => {
    setCart((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const byAmount = !l.byAmount;
      return { ...l, byAmount, amount: byAmount ? String(round2(l.quantity * l.unit_price)) : l.amount };
    }));
  };

  const removeLine = (key) => setCart((prev) => prev.filter((l) => l.key !== key));

  const totals = useMemo(() => cartTotals(cart), [cart]);
  const tenderedNum = Number(tendered) || 0;
  const change = paymentMethod === "cash" ? round2(tenderedNum - totals.total) : 0;
  const canCharge = cart.length > 0 && (paymentMethod !== "cash" || tenderedNum >= totals.total);
  const quickAmounts = useMemo(() => quickTenderAmounts(totals.total), [totals.total]);

  const handleCharge = () => {
    setLastPayment({ method: paymentMethod, tendered: tenderedNum, change });
    checkout.mutate({
      customer_id: customerId || null,
      walk_in_name: customerId ? null : (walkInName || null),
      sale_date: new Date().toISOString().slice(0, 10),
      paid_amount: totals.total,
      items: cart.map((l) => ({
        item_id: l.item_id,
        description: l.name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
      })),
    });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await saleService.downloadPdf(completedSale.id);
      downloadBlob(res.data, `${completedSale.sale_number}.pdf`);
    } catch {
      toast.error("Failed to download invoice");
    } finally {
      setDownloading(false);
    }
  };

  const customerOptions = [{ value: "", label: "Walk-in (no account)" }, ...(customers ?? []).map((c) => ({ value: String(c.id), label: c.name }))];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-4 p-4 lg:h-[calc(100vh-3.5rem)]">
      {/* Product picker */}
      <Card className="flex min-w-0 flex-col gap-3 rounded-xl p-4 lg:h-full lg:min-h-0">
        <div className={cn("grid shrink-0 grid-cols-1 gap-2", customerId ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="h-10 pl-9"
            />
          </div>
          <SelectInput
            value={customerId}
            onChange={setCustomerId}
            options={customerOptions}
            placeholder="Walk-in customer"
            triggerClassName="h-10"
          />
          {!customerId && (
            <TextInput
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="Customer name (optional)"
              inputClassName="h-10 text-sm"
            />
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory("")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                !category ? "border-transparent bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            {categories.map((c) => {
              const color = colorForCategory(c);
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                    active ? cn(color.solid, "border-transparent text-white shadow-sm") : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : color.dot)} />
                  {c}
                </button>
              );
            })}
          </div>
        )}

        <Separator className="shrink-0" />

        <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1.5">
          {filteredItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <PackageSearch className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 p-1.5 sm:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <ProductTile key={item.id} item={item} color={colorForCategory(item.category)} Icon={iconForItem(item)} formatCurrency={formatCurrency} qty={cartQtyByItemId.get(item.id) || 0} onAdd={addToCart} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Cart / checkout */}
      <Card className="flex flex-col overflow-hidden rounded-xl p-0 lg:h-full">
        {completedSale ? (
          <ReceiptSuccess
            sale={completedSale}
            formatCurrency={formatCurrency}
            onViewBill={() => setBillOpen(true)}
            onNewSale={() => {
              setCompletedSale(null);
              setLastPayment(null);
            }}
          />
        ) : (
          <div className="flex flex-col lg:h-full lg:min-h-0">
            <div className="flex shrink-0 items-center gap-2 px-4 py-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShoppingCart className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-semibold text-foreground">Current Sale</p>
              <Badge variant="secondary" className="ml-auto tabular-nums">{cart.length} item{cart.length === 1 ? "" : "s"}</Badge>
            </div>
            <Separator className="shrink-0" />

            <div className="max-h-[280px] flex-1 min-h-0 divide-y lg:max-h-none lg:overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-14 text-center">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Tap a product to add it</p>
                </div>
              ) : (
                cart.map((line) => (
                  <div key={line.key} className="flex items-center gap-2.5 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {line.byAmount
                          ? <>≈ {line.quantity} {line.unit || "unit"} <span className="text-muted-foreground/70">@ {formatCurrency(line.unit_price)}</span></>
                          : <>{formatCurrency(line.unit_price)} / {line.unit || "unit"}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center rounded-full border bg-muted/40">
                      {line.byAmount ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleLineMode(line.key)}
                            title="Switch to quantity entry"
                            className="flex h-7 items-center justify-center rounded-full pl-2.5 pr-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                          >
                            {line.unit || "qty"}
                          </button>
                          <AmountInput value={line.amount} onCommit={(a) => updateAmount(line.key, a)} />
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => updateQty(line.key, round2(line.quantity - (line.quantity > 1 ? 1 : 0.25)))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
                            <Minus className="h-3 w-3" />
                          </button>
                          <QtyInput value={line.quantity} onCommit={(q) => updateQty(line.key, q)} />
                          <button type="button" onClick={() => updateQty(line.key, round2(line.quantity + 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLineMode(line.key)}
                            title="Switch to amount entry"
                            className="flex h-7 items-center justify-center rounded-full pl-1 pr-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                          >
                            Rs
                          </button>
                        </>
                      )}
                    </div>
                    <span className="min-w-[92px] shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums">{formatCurrency(round2(line.quantity * line.unit_price))}</span>
                    <button type="button" onClick={() => removeLine(line.key)} className="shrink-0 rounded-md p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <Separator className="shrink-0" />
            <div className="shrink-0 space-y-3 p-4">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totals.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="tabular-nums">{formatCurrency(totals.tax)}</span></div>
                <Separator className="my-1.5" />
                <div className="flex justify-between text-base font-extrabold text-foreground"><span>Total</span><span className="tabular-nums">{formatCurrency(totals.total)}</span></div>
              </div>

              <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
                <TabsList className="grid w-full grid-cols-3">
                  {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value} className="gap-1.5 text-xs font-semibold">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {paymentMethod === "cash" && (
                <div className="space-y-2">
                  {quickAmounts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {quickAmounts.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTendered(String(amt))}
                          className={cn(
                            "rounded-lg border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors",
                            Number(tendered) === amt ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-border bg-card text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {formatCurrency(amt)}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <TextInput
                      label="Tendered"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tendered}
                      onChange={(e) => setTendered(e.target.value)}
                      inputClassName="h-9 text-sm"
                    />
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Change</label>
                      <div className={cn("flex h-9 items-center rounded-md border bg-card px-2.5 text-sm font-bold tabular-nums", change < 0 ? "border-destructive/40 text-destructive" : "border-emerald-200 text-emerald-600")}>
                        {change >= 0 ? formatCurrency(change) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                size="lg"
                className="w-full bg-emerald-600 text-base shadow-sm shadow-emerald-600/30 hover:bg-emerald-700"
                disabled={!canCharge || checkout.isPending}
                onClick={handleCharge}
              >
                {checkout.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    Charge {formatCurrency(totals.total)}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <BillPreviewModal
        open={billOpen}
        onOpenChange={setBillOpen}
        sale={completedSale}
        company={user?.company}
        payment={lastPayment}
        formatCurrency={formatCurrency}
        onDownload={handleDownload}
        downloading={downloading}
      />
    </div>
  );
}
