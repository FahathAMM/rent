"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { itemService } from "@/services/itemService";
import { customerService } from "@/services/customerService";
import { saleService } from "@/services/saleService";
import { useCompanyCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TextInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { downloadBlob, cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Wallet,
  CreditCard, Landmark, CheckCircle2, Download, RotateCcw,
  Egg, Package,
  PackageSearch, Receipt,
} from "lucide-react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Wallet, active: "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/20" },
  { value: "card", label: "Card", icon: CreditCard, active: "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20" },
  { value: "bank_transfer", label: "Bank", icon: Landmark, active: "bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/20" },
];

const CATEGORY_COLORS = [
  { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-100", border: "border-blue-200", solid: "bg-blue-600", dot: "bg-blue-500" },
  { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100", border: "border-emerald-200", solid: "bg-emerald-600", dot: "bg-emerald-500" },
  { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-100", border: "border-violet-200", solid: "bg-violet-600", dot: "bg-violet-500" },
  { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100", border: "border-amber-200", solid: "bg-amber-600", dot: "bg-amber-500" },
  { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-100", border: "border-rose-200", solid: "bg-rose-600", dot: "bg-rose-500" },
  { bg: "bg-cyan-50", text: "text-cyan-600", ring: "ring-cyan-100", border: "border-cyan-200", solid: "bg-cyan-600", dot: "bg-cyan-500" },
];
const NEUTRAL_COLOR = { bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-200", border: "border-slate-200", solid: "bg-slate-600", dot: "bg-slate-400" };

// Lucide's outline meat icons (Drumstick/Ham/Beef) collapse into an
// unreadable squiggle at this badge size, so the chicken/poultry default
// is a small filled glyph instead — a solid shape stays legible that small.
function ChickenLegIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="12.5" y="10.5" width="11" height="4.2" rx="2.1" transform="rotate(45 12.5 10.5)" />
      <circle cx="8.5" cy="8.5" r="7" />
    </svg>
  );
}

const CATEGORY_ICON_RULES = [
  { match: /egg/i, icon: Egg },
  { match: /suppl|packag|feed|bag|block/i, icon: Package },
];
const NEUTRAL_ICON = ChickenLegIcon;

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
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className={cn(
        "group relative flex flex-col gap-2 rounded-2xl border bg-card p-2.5 text-left shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] active:shadow-sm",
        selected ? cn(color.bg, color.border, "ring-2", color.ring, "shadow-md") : color.border,
      )}
    >
      {selected && (
        <span className={cn("absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white shadow-sm ring-2 ring-card tabular-nums", color.solid)}>
          {Number.isInteger(qty) ? qty : qty.toFixed(2)}
        </span>
      )}
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-110", selected ? "bg-card" : color.bg, color.ring)}>
        <Icon className={cn("h-4 w-4", color.text)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">{item.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.unit?.short_name || item.unit?.name || "unit"}</p>
      </div>
      <p className="w-full truncate text-base font-bold tabular-nums text-foreground">
        {item.effective_selling_price != null ? formatCurrency(item.effective_selling_price) : "—"}
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

function ReceiptSuccess({ sale, formatCurrency, onDownload, downloading, onNewSale }) {
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
        <Button variant="outline" onClick={onDownload} disabled={downloading} className="w-full">
          <Download className="h-4 w-4" />{downloading ? "Preparing..." : "Download Invoice"}
        </Button>
      </div>
    </div>
  );
}

export default function PosPage() {
  const formatCurrency = useCompanyCurrencyFormat();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [completedSale, setCompletedSale] = useState(null);
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

  const iconForCategory = (cat) => {
    if (!cat) return NEUTRAL_ICON;
    return CATEGORY_ICON_RULES.find((rule) => rule.match.test(cat))?.icon ?? NEUTRAL_ICON;
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
        return prev.map((l) => (l.item_id === item.id ? { ...l, quantity: round2(l.quantity + 1) } : l));
      }
      return [...prev, {
        key: item.id,
        item_id: item.id,
        name: item.name,
        unit: item.unit?.short_name || item.unit?.name || "",
        unit_price: Number(item.effective_selling_price) || 0,
        tax_rate: Number(item.tax_rate) || 0,
        quantity: 1,
      }];
    });
  };

  const updateQty = (key, quantity) => {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(0.01, quantity) } : l)));
  };
  const removeLine = (key) => setCart((prev) => prev.filter((l) => l.key !== key));

  const totals = useMemo(() => cartTotals(cart), [cart]);
  const tenderedNum = Number(tendered) || 0;
  const change = paymentMethod === "cash" ? round2(tenderedNum - totals.total) : 0;
  const canCharge = cart.length > 0 && (paymentMethod !== "cash" || tenderedNum >= totals.total);
  const quickAmounts = useMemo(() => quickTenderAmounts(totals.total), [totals.total]);

  const handleCharge = () => {
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
      <div className="flex min-w-0 flex-col gap-3 lg:h-full lg:min-h-0">
        <div className={cn("grid shrink-0 grid-cols-1 gap-2", customerId ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="h-11 rounded-xl bg-card pl-9 shadow-sm"
            />
          </div>
          <SelectInput
            value={customerId}
            onChange={setCustomerId}
            options={customerOptions}
            placeholder="Walk-in customer"
            triggerClassName="h-11 rounded-xl bg-card shadow-sm"
          />
          {!customerId && (
            <TextInput
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="Customer name (optional)"
              inputClassName="h-11 rounded-xl bg-card text-sm shadow-sm"
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
                !category ? "border-transparent bg-primary text-primary-foreground shadow-sm" : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
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
                    active ? cn(color.solid, "border-transparent text-white shadow-sm") : cn("bg-card text-muted-foreground hover:text-foreground", color.border),
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : color.dot)} />
                  {c}
                </button>
              );
            })}
          </div>
        )}

        <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1.5">
          {filteredItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <PackageSearch className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-1.5 sm:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <ProductTile key={item.id} item={item} color={colorForCategory(item.category)} Icon={iconForCategory(item.category)} formatCurrency={formatCurrency} qty={cartQtyByItemId.get(item.id) || 0} onAdd={addToCart} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart / checkout */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm lg:h-full">
        {completedSale ? (
          <ReceiptSuccess
            sale={completedSale}
            formatCurrency={formatCurrency}
            onDownload={handleDownload}
            downloading={downloading}
            onNewSale={() => setCompletedSale(null)}
          />
        ) : (
          <div className="flex flex-col lg:h-full lg:min-h-0">
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border/60 bg-muted/30 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </span>
              <p className="text-sm font-semibold text-foreground">Current Sale</p>
              <Badge variant="secondary" className="ml-auto tabular-nums">{cart.length} item{cart.length === 1 ? "" : "s"}</Badge>
            </div>

            <div className="max-h-[280px] flex-1 min-h-0 divide-y divide-border/60 lg:max-h-none lg:overflow-y-auto">
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
                      <p className="text-xs text-muted-foreground">{formatCurrency(line.unit_price)} / {line.unit || "unit"}</p>
                    </div>
                    <div className="flex shrink-0 items-center rounded-full border border-border/60 bg-muted/40">
                      <button type="button" onClick={() => updateQty(line.key, round2(line.quantity - (line.quantity > 1 ? 1 : 0.25)))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
                        <Minus className="h-3 w-3" />
                      </button>
                      <QtyInput value={line.quantity} onCommit={(q) => updateQty(line.key, q)} />
                      <button type="button" onClick={() => updateQty(line.key, round2(line.quantity + 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="min-w-[92px] shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums">{formatCurrency(round2(line.quantity * line.unit_price))}</span>
                    <button type="button" onClick={() => removeLine(line.key)} className="shrink-0 rounded-md p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 space-y-3 border-t border-border/60 bg-muted/20 px-4 py-3.5">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totals.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="tabular-nums">{formatCurrency(totals.tax)}</span></div>
                <div className="flex justify-between border-t border-border/60 pt-1.5 text-base font-extrabold text-foreground"><span>Total</span><span className="tabular-nums">{formatCurrency(totals.total)}</span></div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map(({ value, label, icon: Icon, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-semibold transition-all duration-150",
                      paymentMethod === value ? active : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

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
                            Number(tendered) === amt ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
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
                      inputClassName="h-9 text-sm bg-card"
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
      </div>
    </div>
  );
}
