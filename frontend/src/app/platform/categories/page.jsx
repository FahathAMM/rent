"use client";

import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { TranslationFields, translationsForm } from "@/components/forms/TranslationFields";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Home, Loader2 } from "lucide-react";
import { ICON_SETS, NamedIcon, VEHICLE_TYPE_ICONS, isIconName, normalizeIconName, resolveCategoryIcon, useIconComponent } from "@/lib/vehicleTypeIcons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ActionButton } from "@/components/Datatable/ActionButton";

const TRANSLATED = ["name"];
const emptyForm = { name: "", slug: "", icon: "", sort_order: 0, is_active: true, translations: translationsForm(null, TRANSLATED) };

/** The icon the home page shows for this category: the one it names, else a guess from its name. */
function TypeIcon({ category }) {
  const { name, auto } = resolveCategoryIcon(category);
  if (!name) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground" title={auto ? `${name} (auto)` : name}>
      <NamedIcon name={name} className="h-5 w-5" />
    </span>
  );
}

/**
 * Quick picks plus a free-text react-icons name. Picking fills the field with the icon's name;
 * typing any name from a supported set uses that icon instead. Empty = auto from the category name.
 */
function IconPicker({ value, onChange, error }) {
  const name = (value ?? "").trim();
  const Icon = useIconComponent(name);
  const status = !name ? "auto" : !isIconName(name) ? "prefix" : Icon === undefined ? "loading" : Icon ? "ok" : "missing";
  const prefixes = Object.entries(ICON_SETS).map(([p, s]) => `${p}… (${s.label})`).join(", ");

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Icon</p>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {[{ name: "", label: "Auto", Icon: null }, ...VEHICLE_TYPE_ICONS].map((t) => {
          const selected = name === t.name;
          return (
            <button
              key={t.name || "auto"}
              type="button"
              onClick={() => onChange(t.name)}
              aria-pressed={selected}
              title={t.name || "Pick from the category name"}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] leading-tight transition-colors hover:bg-muted",
                selected ? "border-primary bg-primary/10 text-primary ring-1 ring-primary" : "text-muted-foreground",
              )}
            >
              {t.Icon ? <t.Icon className="h-5 w-5" /> : <span className="flex h-5 items-center text-xs font-semibold">A</span>}
              <span className="w-full truncate text-center">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground">
          {Icon ? <Icon className="h-5 w-5" /> : status === "loading" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <span className="text-xs font-semibold text-muted-foreground">{name ? "?" : "A"}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <TextInput
            placeholder="e.g. MdDirectionsCarFilled"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value.trim())}
            error={error}
            inputClassName="font-mono"
          />
        </div>
      </div>
      <p className={cn("text-xs", status === "missing" || status === "prefix" ? "text-destructive" : "text-muted-foreground")}>
        {status === "missing" && <>No icon called &quot;{name}&quot; — check the spelling and capitals. </>}
        {status === "prefix" && <>The name must start with {Object.keys(ICON_SETS).join(", ")}. </>}
        Any icon name from{" "}
        <a href="https://react-icons.github.io/react-icons/" target="_blank" rel="noreferrer" className="underline underline-offset-2">react-icons</a>
        {" "}in {prefixes} works. Leave empty to pick one from the category name.
      </p>
    </div>
  );
}

export default function PlatformCategoriesPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const invalidate = () => setRefreshKey((k) => k + 1);

  const save = useMutation({
    mutationFn: (payload) => editing ? platformService.categories.update(editing.id, payload) : platformService.categories.create(payload),
    onSuccess: () => { invalidate(); toast.success(editing ? "Category updated" : "Category created"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => platformService.categories.delete(id),
    onSuccess: () => { invalidate(); toast.success("Category deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.errors?.category?.[0] ?? err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, icon: normalizeIconName(c.icon), sort_order: c.sort_order ?? 0, is_active: !!c.is_active, translations: translationsForm(c.translations, TRANSLATED) });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    const payload = {
      name: form.name,
      slug: form.slug,
      icon: form.icon || null,
      sort_order: Number(form.sort_order),
      is_active: form.is_active,
      translations: form.translations,
    };

    save.mutate(payload);
  };

  const columns = () => [
    {
      accessorKey: "icon", header: "Icon",
      cell: (row) => <TypeIcon category={row} />,
    },
    { accessorKey: "name", header: "Name", cell: (row) => <span className="font-medium">{row.name}</span> },
    { accessorKey: "slug", header: "Slug" },
    { accessorKey: "vehicles_count", header: "Vehicles", cell: (row) => row.vehicles_count },
    { accessorKey: "is_active", header: "Status", cell: (row) => <StatusBadge status={row.is_active} /> },
    {
      accessorKey: "actions", header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Categories" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          api={platformApi}
          endpoint="/platform/categories"
          columns={columns}
          breadcrumb={[]}
          isSheet
          openSheet={openCreate}
          model="Category"
        />
      </HomePageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name?.[0]} />
            <TranslationFields
              value={form.translations}
              onChange={(translations) => setForm({ ...form, translations })}
              fields={[{ key: "name", label: "Name" }]}
              english={{ name: form.name }}
              errors={errors}
            />
            <TextInput label="Slug" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} error={errors.slug?.[0]} />
            <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} error={errors.icon?.[0]} />
            <TextInput label="Sort order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} error={errors.sort_order?.[0]} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              Active
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. A category still assigned to vehicles cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteTarget.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
