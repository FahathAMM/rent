"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformCityService } from "@/services/platformCityService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Trash2, Plus, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { district_id: "", name: "" };

export default function PlatformCitiesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: districts, isLoading } = useQuery({
    queryKey: ["platform-cities"],
    queryFn: () => platformCityService.getAll().then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-cities"] });

  const save = useMutation({
    mutationFn: (payload) => platformCityService.create(payload),
    onSuccess: () => { invalidate(); toast.success("City added"); setOpen(false); setForm(emptyForm); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => platformCityService.delete(id),
    onSuccess: () => { invalidate(); toast.success("City deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const openCreate = () => { setForm(emptyForm); setErrors({}); setOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate({ district_id: Number(form.district_id), name: form.name });
  };

  const districtOptions = (districts ?? []).map((d) => ({ value: String(d.id), label: d.name }));
  const cities = (districts ?? []).flatMap((d) => d.cities.map((c) => ({ ...c, district_name: d.name })));

  const columns = [
    { key: "district_name", header: "District", render: (row) => <span className="font-medium">{row.district_name}</span> },
    { key: "name", header: "City" },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /></Button>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Cities" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Districts & Cities"
          description="Sri Lanka's 25 districts are fixed — add the cities that feed the owner/shop onboarding location dropdowns."
          action={<Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New City</Button>}
        />

        <DataTable columns={columns} data={cities} loading={isLoading} />
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New City</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <SelectInput label="District" required placeholder="Select district" options={districtOptions} value={form.district_id} onChange={(v) => setForm({ ...form, district_id: v })} error={errors.district_id?.[0]} />
            <TextInput label="City name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name?.[0]} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending || !form.district_id || !form.name}>
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
            <AlertDialogDescription>This removes it from the onboarding location dropdowns. It cannot be undone.</AlertDialogDescription>
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
