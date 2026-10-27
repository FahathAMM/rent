"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformBrandService } from "@/services/platformBrandService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BrandMark } from "@/components/marketplace/BrandMark";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Plus, Home, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { name: "", slug: "", sort_order: 0, is_active: true };

// Mirrors StoreBrandRequest::LOGO_RULES so a bad file is caught before uploading.
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_MB = 2;
const LOGO_MIN_PX = 64;
const LOGO_MAX_PX = 2000;

function readImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("unreadable")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Resolves to an error message, or null when the file is acceptable. */
async function checkLogo(file) {
  if (!LOGO_TYPES.includes(file.type)) return "The logo must be a PNG, JPG or WebP image.";
  if (file.size > LOGO_MAX_MB * 1024 * 1024) return `The logo must be ${LOGO_MAX_MB} MB or smaller (this one is ${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  try {
    const { width, height } = await readImageSize(file);
    if (width < LOGO_MIN_PX || height < LOGO_MIN_PX || width > LOGO_MAX_PX || height > LOGO_MAX_PX) {
      return `The logo must be between ${LOGO_MIN_PX}×${LOGO_MIN_PX} and ${LOGO_MAX_PX}×${LOGO_MAX_PX} pixels (this one is ${width}×${height}).`;
    }
  } catch {
    return "That file couldn't be read as an image.";
  }
  return null;
}

const slugify = (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function PlatformBrandsPage() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-brands"],
    queryFn: () => platformBrandService.getAll().then((r) => r.data.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-brands"] });
    qc.invalidateQueries({ queryKey: ["public-brands"] });
  };

  const save = useMutation({
    mutationFn: (fd) => editing ? platformBrandService.update(editing.id, fd) : platformBrandService.create(fd),
    onSuccess: () => { invalidate(); toast.success(editing ? "Brand updated" : "Brand created"); setOpen(false); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      // Not a validation error (e.g. a 500) - say so instead of failing silently.
      if (err.response?.status !== 422) toast.error(err.networkError ?? err.response?.data?.message ?? "Could not save");
    },
  });

  const remove = useMutation({
    mutationFn: (id) => platformBrandService.delete(id),
    onSuccess: () => { invalidate(); toast.success("Brand deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.errors?.brand?.[0] ?? err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const resetLogo = () => { setLogoFile(null); setRemoveLogo(false); };

  const openCreate = () => { setEditing(null); setForm(emptyForm); resetLogo(); setErrors({}); setOpen(true); };
  const openEdit = (b) => {
    setEditing(b);
    setForm({ name: b.name, slug: b.slug, sort_order: b.sort_order ?? 0, is_active: !!b.is_active });
    resetLogo();
    setErrors({});
    setOpen(true);
  };

  // Auto-fill the slug from the name until the admin edits the slug themselves.
  const setName = (name) => setForm((p) => ({
    ...p,
    name,
    slug: !editing && (p.slug === "" || p.slug === slugify(p.name)) ? slugify(name) : p.slug,
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("slug", form.slug);
    fd.append("sort_order", String(Number(form.sort_order) || 0));
    fd.append("is_active", form.is_active ? "1" : "0");
    if (logoFile) fd.append("logo", logoFile);
    if (editing && removeLogo && !logoFile) fd.append("remove_logo", "1");
    save.mutate(fd);
  };

  const filePreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);
  const previewUrl = filePreview ?? (!removeLogo ? editing?.logo_url : null);

  const columns = [
    {
      key: "name", header: "Brand",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <BrandMark brand={row} className="size-8" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    { key: "slug", header: "Slug" },
    { key: "vehicles_count", header: "Vehicles", render: (row) => row.vehicles_count },
    { key: "sort_order", header: "Order" },
    { key: "is_active", header: "Status", render: (row) => <StatusBadge status={row.is_active} /> },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex gap-1.5">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Brands" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Vehicle Brands"
          description="The brand list vendors pick from, and the brand filter and logo row customers see."
          action={<Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Brand</Button>}
        />

        <DataTable columns={columns} data={data ?? []} loading={isLoading} />
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Brand" : "New Brand"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <TextInput label="Name" required value={form.name} onChange={(e) => setName(e.target.value)} error={errors.name?.[0]} />
            <TextInput label="Slug" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} error={errors.slug?.[0]} />

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Logo (optional)</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!file) return;
                  const problem = await checkLogo(file);
                  if (problem) {
                    setErrors((p) => ({ ...p, logo: [problem] }));
                    return;
                  }
                  setErrors(({ logo, ...rest }) => rest);
                  setLogoFile(file);
                  setRemoveLogo(false);
                }}
              />
              <div className="flex items-center gap-3 rounded-lg border p-2.5">
                <BrandMark brand={{ name: form.name || "?", logo_url: previewUrl }} className="size-12" />
                <div className="flex flex-1 flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                    <UploadCloud className="h-3.5 w-3.5" /> {previewUrl ? "Replace" : "Upload"}
                  </Button>
                  {previewUrl && (
                    <Button
                      type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive"
                      onClick={() => { setLogoFile(null); setRemoveLogo(true); }}
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
              {errors.logo?.[0] && <p className="text-xs text-destructive">{errors.logo[0]}</p>}
              <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB, between 64×64 and 2000×2000 px. A square PNG on a transparent background works best.</p>
            </div>

            <TextInput label="Sort order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} error={errors.sort_order?.[0]} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              Active (vendors can pick it)
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
            <AlertDialogDescription>This cannot be undone. A brand still assigned to vehicles cannot be deleted — deactivate it instead.</AlertDialogDescription>
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
