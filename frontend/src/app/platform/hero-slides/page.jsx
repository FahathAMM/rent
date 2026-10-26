"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformHeroSlideService } from "@/services/platformHeroSlideService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Pencil, Trash2, Plus, Home, Loader2, UploadCloud, ArrowUp, ArrowDown, Eye, EyeOff, ImageIcon, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const emptyForm = { title: "", subtitle: "", link_url: "", link_label: "", is_active: true };

/** Hero preview: the slide image under the same dark overlay the home page uses, with the headline on top. */
function SlidePreview({ image, title, subtitle, linkLabel, className }) {
  return (
    <div className={cn("relative overflow-hidden bg-slate-900", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/40"><ImageIcon className="h-10 w-10" /></div>
      )}
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
      <div className="relative flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center text-white">
        <p className="line-clamp-2 text-lg font-semibold leading-tight drop-shadow-sm">{title || "Your headline"}</p>
        {subtitle && <p className="line-clamp-2 text-xs text-white/80">{subtitle}</p>}
        {linkLabel && <span className="mt-1 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-foreground">{linkLabel}</span>}
      </div>
    </div>
  );
}

export default function PlatformHeroSlidesPage() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: slides, isLoading } = useQuery({
    queryKey: ["platform-hero-slides"],
    queryFn: () => platformHeroSlideService.getAll().then((r) => r.data.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-hero-slides"] });
    qc.invalidateQueries({ queryKey: ["public-hero-slides"] });
  };

  const toFormData = (values, file) => {
    const fd = new FormData();
    fd.append("title", values.title);
    fd.append("subtitle", values.subtitle ?? "");
    fd.append("link_url", values.link_url ?? "");
    fd.append("link_label", values.link_label ?? "");
    fd.append("is_active", values.is_active ? "1" : "0");
    if (file) fd.append("image", file);
    return fd;
  };

  const save = useMutation({
    mutationFn: (fd) => (editing ? platformHeroSlideService.update(editing.id, fd) : platformHeroSlideService.create(fd)),
    onSuccess: () => { invalidate(); toast.success(editing ? "Slide updated" : "Slide added"); setOpen(false); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (err.response?.status !== 422) toast.error(err.networkError ?? err.response?.data?.message ?? "Could not save");
    },
  });

  const toggle = useMutation({
    mutationFn: (s) => platformHeroSlideService.update(s.id, toFormData({ ...s, is_active: !s.is_active })),
    onSuccess: (_, s) => { invalidate(); toast.success(s.is_active ? "Slide hidden" : "Slide shown"); },
    onError: () => toast.error("Could not update slide"),
  });

  const reorder = useMutation({
    mutationFn: (ids) => platformHeroSlideService.reorder(ids),
    onSuccess: invalidate,
    onError: () => toast.error("Could not reorder"),
  });

  const remove = useMutation({
    mutationFn: (id) => platformHeroSlideService.delete(id),
    onSuccess: () => { invalidate(); toast.success("Slide deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const move = (index, dir) => {
    const ids = (slides ?? []).map((s) => s.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    reorder.mutate(ids);
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setImageFile(null); setErrors({}); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ title: s.title, subtitle: s.subtitle ?? "", link_url: s.link_url ?? "", link_label: s.link_label ?? "", is_active: !!s.is_active });
    setImageFile(null);
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate(toFormData(form, imageFile));
  };

  const filePreview = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);
  const previewUrl = filePreview ?? editing?.image_url ?? null;

  const activeCount = (slides ?? []).filter((s) => s.is_active).length;

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Hero Slides" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Home Page Hero Slides"
          description="The banner images and headlines that rotate at the top of the home page. With no active slides, the hero falls back to featured vehicle photos and the default headline."
          action={<Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Slide</Button>}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{slides?.length ?? 0} slides · {activeCount} showing on the home page</span>
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-primary hover:underline">
            View home page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !slides?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No hero slides yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Add a wide banner image with a headline — it will show at the top of the home page.</p>
            <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Add your first slide</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {slides.map((s, i) => (
              <div key={s.id} className={cn("overflow-hidden rounded-xl border bg-card shadow-sm", !s.is_active && "opacity-60")}>
                <div className="relative">
                  <SlidePreview image={s.image_url} title={s.title} subtitle={s.subtitle} linkLabel={s.link_label} className="aspect-[16/7]" />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">#{i + 1}</span>
                  <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold", s.is_active ? "bg-emerald-600 text-white" : "bg-slate-600 text-white")}>
                    {s.is_active ? "Showing" : "Hidden"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.link_url || "No button link"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === slides.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={toggle.isPending} onClick={() => toggle.mutate(s)} aria-label={s.is_active ? "Hide slide" : "Show slide"}>
                      {s.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)} aria-label="Edit slide"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(s)} aria-label="Delete slide"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Slide" : "New Slide"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />

            <div className="space-y-1.5">
              <SlidePreview image={previewUrl} title={form.title} subtitle={form.subtitle} linkLabel={form.link_url ? form.link_label || "Learn more" : null} className="aspect-[16/7] rounded-lg" />
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
              />
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                <UploadCloud className="h-3.5 w-3.5" /> {previewUrl ? "Replace image" : "Upload image"}
              </Button>
              {errors.image?.[0] && <p className="text-xs text-destructive">{errors.image[0]}</p>}
              <p className="text-xs text-muted-foreground">Wide photo, at least 1920 × 900 px. JPG, PNG or WebP up to 5 MB. Text sits in the centre, so keep the subject clear of it.</p>
            </div>

            <TextInput label="Headline" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title?.[0]} placeholder="e.g. Rent any vehicle, anywhere in Sri Lanka" />
            <TextareaInput label="Subtitle (optional)" rows={2} maxLength={255} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} error={errors.subtitle?.[0]} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Button link (optional)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} error={errors.link_url?.[0]} placeholder="/browse?category_id=3" />
              <TextInput label="Button text" maxLength={40} value={form.link_label} onChange={(e) => setForm({ ...form, link_label: e.target.value })} error={errors.link_label?.[0]} placeholder="See SUVs" disabled={!form.link_url} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              Show on the home page
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending || (!editing && !imageFile)}>
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
            <AlertDialogTitle>Delete &quot;{deleteTarget?.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>The slide and its image are removed permanently. To take it off the home page temporarily, hide it instead.</AlertDialogDescription>
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
