"use client";

import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, Home, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/Datatable/ActionButton";

export default function PlatformCitiesPage() {
  const qc = useQueryClient();
  const [editingDistrictId, setEditingDistrictId] = useState(null);
  const [newCityName, setNewCityName] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: districts } = useQuery({
    queryKey: ["platform-cities"],
    queryFn: () => platformService.cities.getAll().then((r) => r.data.data),
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-cities"] });
    setRefreshKey((k) => k + 1);
  };

  const save = useMutation({
    mutationFn: (payload) => platformService.cities.create(payload),
    onSuccess: () => { invalidate(); toast.success("City added"); setNewCityName(""); setError(""); },
    onError: (err) => setError(err.response?.data?.errors?.name?.[0] ?? "Failed to add city"),
  });

  const remove = useMutation({
    mutationFn: (id) => platformService.cities.delete(id),
    onSuccess: () => { invalidate(); toast.success("City deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const editingDistrict = (districts ?? []).find((d) => d.id === editingDistrictId) ?? null;

  const handleAddCity = (e) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    save.mutate({ district_id: editingDistrictId, name: newCityName.trim() });
  };

  const columns = () => [
    { accessorKey: "name", header: "District", cell: (row) => <span className="font-medium">{row.name}</span> },
    { accessorKey: "cities_count", header: "Cities", cell: (row) => row.cities.length },
    {
      accessorKey: "actions", header: "Actions",
      cell: (row) => (
        <ActionButton onClick={() => { setEditingDistrictId(row.id); setNewCityName(""); setError(""); }} icon={Pencil} label="Edit cities" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Cities" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          api={platformApi}
          endpoint="/platform/cities"
          columns={columns}
          breadcrumb={[]}
        />
      </HomePageWrapper>

      <Dialog open={!!editingDistrict} onOpenChange={(v) => !v && setEditingDistrictId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {editingDistrict?.name}</DialogTitle>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            {editingDistrict?.cities.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {editingDistrict.cities.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span className="truncate">{c.name}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No cities added yet.</p>
            )}
          </div>

          <form onSubmit={handleAddCity} className="flex items-start gap-2 border-t pt-3">
            <div className="flex-1 space-y-1">
              <Input placeholder="New city name" value={newCityName} onChange={(e) => setNewCityName(e.target.value)} />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button type="submit" disabled={save.isPending || !newCityName.trim()} className="gap-1.5">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
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
