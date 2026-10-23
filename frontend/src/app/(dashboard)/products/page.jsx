"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { itemService } from "@/services/itemService";
import { itemDailyPriceService } from "@/services/itemDailyPriceService";
import { unitService } from "@/services/unitService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Fieldset } from "@/components/forms/Fieldset";
import { toast } from "sonner";
import { Pencil, Trash2, Home, Tag, History, Wand2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { ITEM_ICONS, getItemIcon } from "@/lib/itemIcons";

const DEFAULT_ITEM_ICON = getItemIcon("drumstick");
import Link from "next/link";

const defaultForm = {
  name: "",
  sku: "",
  category: "",
  icon: "",
  unit_id: "",
  purchase_price: "",
  selling_price: "",
  tax_rate: "",
  is_active: "1",
  notes: "",
};

function IconPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange("")}
        title="Auto (by category)"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
          !value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
        )}
      >
        <Wand2 className="h-4 w-4" />
      </button>
      {ITEM_ICONS.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          title={label}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
            value === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function QuickPriceModal({ open, onOpenChange }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["items-quick-price"],
    queryFn: () => itemService.getAll({ perPage: 100 }).then((r) => r.data.record.data),
    enabled: open,
  });

  useEffect(() => {
    if (open && items) {
      setRows(
        items
          .filter((i) => i.is_active)
          .map((i) => ({
            id: i.id,
            purchase_price: i.today_purchase_price ?? "",
            selling_price: i.today_selling_price ?? "",
            original_purchase_price: i.today_purchase_price ?? "",
            original_selling_price: i.today_selling_price ?? "",
            raw: i,
          }))
      );
    }
  }, [open, items]);

  const setPrice = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const dirtyRows = rows.filter(
    (r) => String(r.purchase_price) !== String(r.original_purchase_price) || String(r.selling_price) !== String(r.original_selling_price)
  );

  const handleSave = async () => {
    if (dirtyRows.length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const res = await itemDailyPriceService.save(
        dirtyRows.map((r) => ({
          item_id: r.id,
          purchase_price: r.purchase_price || null,
          selling_price: r.selling_price || null,
        }))
      );
      toast.success(res.data?.message ?? "Today's prices updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to update prices");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Quick Price Update" size="2xl" headerBorder>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Set today&apos;s purchase &amp; selling price per product. Leave a field blank to use its base price (shown as the placeholder). Only changed rows are saved.
        </p>

        <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] font-medium text-muted-foreground px-1">
          <div className="col-span-6">Product</div>
          <div className="col-span-3">Today&apos;s Purchase Price</div>
          <div className="col-span-3">Today&apos;s Selling Price</div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-lg border divide-y">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading products...</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No active products found.</div>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="grid grid-cols-12 gap-2 items-center px-2 py-2">
                <div className="col-span-12 md:col-span-6 min-w-0">
                  <p className="truncate text-sm font-medium">{row.raw.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.raw.category || "—"}{row.raw.unit ? ` · ${row.raw.unit.short_name || row.raw.unit.name}` : ""}
                  </p>
                </div>
                <div className="col-span-6 md:col-span-3">
                  <TextInput
                    type="number" step="0.01" min="0"
                    placeholder={row.raw.purchase_price != null ? Number(row.raw.purchase_price).toFixed(2) : "0.00"}
                    value={row.purchase_price}
                    onChange={(e) => setPrice(row.id, "purchase_price", e.target.value)}
                    inputClassName="h-8 text-xs"
                  />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <TextInput
                    type="number" step="0.01" min="0"
                    placeholder={row.raw.selling_price != null ? Number(row.raw.selling_price).toFixed(2) : "0.00"}
                    value={row.selling_price}
                    onChange={(e) => setPrice(row.id, "selling_price", e.target.value)}
                    inputClassName="h-8 text-xs"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "Saving..." : dirtyRows.length > 0 ? `Save ${dirtyRows.length} change${dirtyRows.length === 1 ? "" : "s"}` : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function ProductsPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [quickPriceOpen, setQuickPriceOpen] = useState(false);

  const { data: units } = useQuery({
    queryKey: ["units-lite"],
    queryFn: () => unitService.getAll({ perPage: 100 }).then((r) => r.data.record.data),
  });

  const create = useMutation({
    mutationFn: itemService.create,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Product created");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => itemService.update(id, data),
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Product updated");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: itemService.delete,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Product deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));
  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku ?? "",
      category: item.category ?? "",
      icon: item.icon ?? "",
      unit_id: item.unit_id ? String(item.unit_id) : "",
      purchase_price: item.purchase_price ?? "",
      selling_price: item.selling_price ?? "",
      tax_rate: item.tax_rate ?? "",
      is_active: item.is_active ? "1" : "0",
      notes: item.notes ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      name: form.name,
      sku: form.sku || null,
      category: form.category || null,
      icon: form.icon || null,
      unit_id: form.unit_id,
      purchase_price: form.purchase_price || null,
      selling_price: form.selling_price || null,
      tax_rate: form.tax_rate || null,
      is_active: form.is_active === "1",
      notes: form.notes || null,
    };

    if (editing) update.mutate({ id: editing.id, data: payload });
    else create.mutate(payload);
  };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "name",
      header: () => <SortableHeader label="Name" column="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => {
        const Icon = getItemIcon(row.icon) ?? DEFAULT_ITEM_ICON;
        return (
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">{row.name}</p>
              {row.sku && <p className="text-[10px] text-muted-foreground font-mono">{row.sku}</p>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: () => <SortableHeader label="Category" column="category" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => row.category ?? "—",
    },
    {
      accessorKey: "unit",
      header: "Unit",
      cell: (row) => row.unit?.short_name || row.unit?.name || "—",
    },
    {
      accessorKey: "purchase_price",
      header: "Purchase Price",
      cell: (row) => (row.purchase_price != null ? Number(row.purchase_price).toFixed(2) : "—"),
    },
    {
      accessorKey: "selling_price",
      header: () => <SortableHeader label="Selling Price" column="selling_price" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => (row.selling_price != null ? Number(row.selling_price).toFixed(2) : "—"),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: (row) => <StatusBadge status={row.is_active} />,
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {can("product-item-edit") && (
            <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit product" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("product-item-delete") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete product" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const isPending = create.isPending || update.isPending;

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Products" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/items"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="name"
          defaultSortOrder="asc"
          isSheet={can("product-item-create")}
          openSheet={openCreate}
          model="Product"
          actions={
            <>
              {can("product-item-view") && (
                <Link href="/products/price-history">
                  <Button variant="outline" className="gap-1.5 h-8 flex items-center text-xs px-2.5">
                    <History className="w-4 h-4 stroke-[2]" />
                    <span>Price History</span>
                  </Button>
                </Link>
              )}
              {can("product-item-edit") && (
                <Button
                  variant="outline"
                  className="gap-1.5 h-8 flex items-center text-xs px-2.5"
                  onClick={() => setQuickPriceOpen(true)}
                >
                  <Tag className="w-4 h-4 stroke-[2]" />
                  <span>Quick Price Update</span>
                </Button>
              )}
            </>
          }
        />
      </HomePageWrapper>

      <QuickPriceModal
        open={quickPriceOpen}
        onOpenChange={(v) => {
          setQuickPriceOpen(v);
          if (!v) setRefreshKey((k) => k + 1);
        }}
      />

      <Modal open={open} onOpenChange={setOpen} title={editing ? "Edit Product" : "Add Product"} size="2xl" headerBorder>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ValidationError errors={errors} />

          <Fieldset legend="Details" grid={2}>
            <TextInput label="Name" value={form.name} onChange={fi("name")} required error={errors.name?.[0]} />
            <TextInput label="SKU" value={form.sku} onChange={fi("sku")} placeholder="Optional" error={errors.sku?.[0]} />
            <TextInput label="Category" value={form.category} onChange={fi("category")} placeholder="e.g. Poultry, Feed, Packaging" error={errors.category?.[0]} />
            <SelectInput
              label="Unit"
              value={form.unit_id}
              onChange={f("unit_id")}
              options={(units ?? []).map((u) => ({ value: String(u.id), label: u.name }))}
              placeholder="Select unit"
              required
              error={errors.unit_id?.[0]}
            />
          </Fieldset>

          <Fieldset legend="Icon" grid={1}>
            <div className="space-y-1.5">
              <IconPicker value={form.icon} onChange={f("icon")} />
              <p className="text-xs text-muted-foreground">Shown on the POS screen. Leave on Auto to pick one from the category instead.</p>
              {errors.icon?.[0] && <p className="text-xs text-destructive">{errors.icon[0]}</p>}
            </div>
          </Fieldset>

          <Fieldset legend="Pricing" grid={3}>
            <TextInput label="Purchase Price" type="number" step="0.01" min="0" value={form.purchase_price} onChange={fi("purchase_price")} error={errors.purchase_price?.[0]} />
            <TextInput label="Selling Price" type="number" step="0.01" min="0" value={form.selling_price} onChange={fi("selling_price")} error={errors.selling_price?.[0]} />
            <TextInput label="Tax Rate (%)" type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={fi("tax_rate")} error={errors.tax_rate?.[0]} />
          </Fieldset>

          <Fieldset legend="Status & Notes" grid={2}>
            <SelectInput
              label="Status"
              value={form.is_active}
              onChange={f("is_active")}
              options={[
                { value: "1", label: "Active" },
                { value: "0", label: "Inactive" },
              ]}
            />
            <TextInput label="Notes" value={form.notes} onChange={fi("notes")} error={errors.notes?.[0]} />
          </Fieldset>

          <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Product"
        description={`Delete "${deleteTarget?.name}"?`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
