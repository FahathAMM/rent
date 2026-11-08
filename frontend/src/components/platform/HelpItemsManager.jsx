"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { groupBySection } from "@/hooks/useHelpItems";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const swap = (list, index, direction) => {
  const next = [...list];
  [next[index], next[index + direction]] = [next[index + direction], next[index]];
  return next;
};

function MoveButtons({ index, count, disabled, onMove, label }) {
  return (
    <>
      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${label} up`}><ArrowUp className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || index === count - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${label} down`}><ArrowDown className="h-4 w-4" /></Button>
    </>
  );
}

/**
 * Add, edit, hide, reorder and delete the help items of one type. Pass
 * sectionLabel for types grouped into sections, and bodyLabel for types with
 * a second field (shortBody makes that a one-line input, rich a rich text editor).
 */
export function HelpItemsManager({ type, heading, description, itemName, titleLabel, bodyLabel, shortBody = false, rich = false, sectionLabel }) {
  const qc = useQueryClient();
  const emptyForm = { section: "", title: "", body: "", is_active: true };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["platform-help-items", type],
    queryFn: () => platformService.helpItems.getAll(type).then((r) => r.data.data),
  });
  const sections = groupBySection(items);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-help-items", type] });
    qc.invalidateQueries({ queryKey: ["public-help-items"] });
  };

  const save = useMutation({
    mutationFn: (values) => {
      const payload = { ...values, type };
      return editing ? platformService.helpItems.update(editing.id, payload) : platformService.helpItems.create(payload);
    },
    onSuccess: () => { invalidate(); toast.success(`${itemName} saved`); setOpen(false); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (err.response?.status !== 422) toast.error(err.networkError ?? err.response?.data?.message ?? "Could not save");
    },
  });

  const toggle = useMutation({
    mutationFn: (item) => platformService.helpItems.update(item.id, { ...item, is_active: !item.is_active }),
    onSuccess: (_, item) => { invalidate(); toast.success(`${itemName} ${item.is_active ? "hidden" : "shown"}`); },
    onError: () => toast.error("Could not update"),
  });

  const reorder = useMutation({
    mutationFn: (ids) => platformService.helpItems.reorder(ids),
    onSuccess: invalidate,
    onError: () => toast.error("Could not reorder"),
  });

  const remove = useMutation({
    mutationFn: (id) => platformService.helpItems.delete(id),
    onSuccess: () => { invalidate(); toast.success(`${itemName} deleted`); setDeleteTarget(null); },
    onError: () => toast.error("Could not delete"),
  });

  const saveOrder = (orderedSections) => reorder.mutate(orderedSections.flatMap((s) => s.items.map((item) => item.id)));
  const moveSection = (index, direction) => saveOrder(swap(sections, index, direction));
  const moveItem = (sectionIndex, index, direction) => saveOrder(
    sections.map((s, i) => (i === sectionIndex ? { ...s, items: swap(s.items, index, direction) } : s))
  );

  const openForm = (item) => {
    setEditing(item);
    setForm(item ? { section: item.section ?? "", title: item.title, body: item.body ?? "", is_active: item.is_active } : emptyForm);
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate(form);
  };

  const listId = `${type}-sections`;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{heading}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        <Button onClick={() => openForm(null)} className="gap-1.5"><Plus className="h-4 w-4" /> Add {itemName.toLowerCase()}</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">Nothing here yet. This part of the page stays hidden until you add something.</p>
      ) : (
        <div className="space-y-5">
          {sections.map(({ name, items: sectionItems }, sectionIndex) => (
            <div key={name}>
              {sectionLabel && (
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{name}</h3>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <MoveButtons index={sectionIndex} count={sections.length} disabled={reorder.isPending} onMove={moveSection} label="section" />
                  </div>
                </div>
              )}
              <div className="divide-y rounded-xl border">
                {sectionItems.map((item, index) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 p-3">
                    <div className={cn("min-w-0", !item.is_active && "opacity-60")}>
                      <p className="break-words text-sm font-medium">{item.title}</p>
                      {item.body && <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground">{rich ? item.body.replace(/<[^>]+>/g, " ") : item.body}</p>}
                      {!item.is_active && <p className="mt-1 text-xs font-medium text-muted-foreground">Hidden</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <MoveButtons index={index} count={sectionItems.length} disabled={reorder.isPending} onMove={(i, direction) => moveItem(sectionIndex, i, direction)} label={itemName.toLowerCase()} />
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={toggle.isPending} onClick={() => toggle.mutate(item)} aria-label={item.is_active ? `Hide ${itemName.toLowerCase()}` : `Show ${itemName.toLowerCase()}`}>
                        {item.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openForm(item)} aria-label={`Edit ${itemName.toLowerCase()}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(item)} aria-label={`Delete ${itemName.toLowerCase()}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto", rich ? "max-w-2xl" : "max-w-lg")}>
          <DialogHeader><DialogTitle>{editing ? `Edit ${itemName.toLowerCase()}` : `Add ${itemName.toLowerCase()}`}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />

            {sectionLabel && (
              <>
                <TextInput label={sectionLabel} required maxLength={120} list={listId} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} error={errors.section?.[0]} placeholder="Choose one, or type a new name" />
                <datalist id={listId}>
                  {sections.map(({ name }) => <option key={name} value={name} />)}
                </datalist>
              </>
            )}
            <TextInput label={titleLabel} required maxLength={255} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title?.[0]} />
            {bodyLabel && (rich ? (
              <div className="space-y-1.5">
                <Label>{bodyLabel} <span className="text-destructive">*</span></Label>
                <RichTextEditor value={form.body} onChange={(body) => setForm((f) => ({ ...f, body }))} minHeight="min-h-[220px]" />
                {errors.body?.[0] && <p className="text-xs text-destructive">{errors.body[0]}</p>}
              </div>
            ) : shortBody ? (
              <TextInput label={bodyLabel} required maxLength={30} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} error={errors.body?.[0]} />
            ) : (
              <TextareaInput label={bodyLabel} required rows={5} maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} error={errors.body?.[0]} />
            ))}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              Show on the website
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
            <AlertDialogTitle>Delete this {itemName.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone. To take it off the website for now, hide it instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteTarget.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
