"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Home, Loader2, Lock, Users as UsersIcon, KeyRound } from "lucide-react";
import { toast } from "sonner";

const ACTIONS = ["view", "create", "edit", "delete"];

/**
 * Platform-wide roles and what each may do. Shop owner/manager/staff and the
 * customer role are shared by every shop, so only the platform edits them —
 * and only the Platform Owner can save. The Shop Owner role always has every
 * vendor permission and is shown locked.
 */
export default function PlatformRolesPage() {
  const qc = useQueryClient();
  const admin = usePlatformAuthStore((s) => s.admin);
  const canEdit = admin?.admin_role === "platform_owner";

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["platform-roles"],
    queryFn: () => platformService.roles.getAll().then((r) => r.data.data),
  });
  const { data: groups, isLoading: permsLoading } = useQuery({
    queryKey: ["platform-permissions"],
    queryFn: () => platformService.roles.permissions().then((r) => r.data.data),
  });

  const [selectedId, setSelectedId] = useState(null);
  const selected = roles?.find((r) => r.id === selectedId) ?? roles?.[0];
  const [draft, setDraft] = useState(new Set());

  // Load the selected role's permissions into an editable draft.
  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
  }, [selected?.id, selected?.permissions?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only the pages of the role's own side (vendor or customer) apply to it.
  const rows = useMemo(
    () => (groups ?? []).filter((g) => !selected?.audience || g.audience === selected.audience),
    [groups, selected?.audience]
  );

  const locked = !canEdit;
  const saved = useMemo(() => new Set(selected?.permissions ?? []), [selected]);
  const changes = useMemo(() => {
    let n = 0;
    draft.forEach((p) => { if (!saved.has(p)) n++; });
    saved.forEach((p) => { if (!draft.has(p)) n++; });
    return n;
  }, [draft, saved]);

  const save = useMutation({
    mutationFn: () => platformService.roles.update(selected.id, { permissions: [...draft] }),
    onSuccess: () => {
      toast.success(`${selected.label} permissions saved`);
      qc.invalidateQueries({ queryKey: ["platform-roles"] });
    },
    onError: (err) => toast.error(err.response?.data?.errors?.permissions?.[0] ?? err.response?.data?.message ?? "Failed to save"),
  });

  const toggle = (names, on) => setDraft((prev) => {
    const next = new Set(prev);
    names.forEach((n) => (on ? next.add(n) : next.delete(n)));
    return next;
  });

  const columnPerms = (action) => rows.map((g) => g.permissions[action]).filter(Boolean);
  const allOn = (names) => names.length > 0 && names.every((n) => draft.has(n));
  const someOn = (names) => names.some((n) => draft.has(n));

  const breadcrumb = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Roles & Permissions" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader
        title="Roles & Permissions"
        description="What each role can see and do. Roles are shared by every shop — shop owners pick a role when they add staff."
      />

      {rolesLoading || permsLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* ── Roles ── */}
          <div className="space-y-2">
            {roles?.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "w-full rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors",
                  selected?.id === r.id ? "border-primary ring-1 ring-primary/30" : "hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    {r.label}
                  </span>
                  <Badge variant="secondary" className="capitalize">{r.audience ?? "—"}</Badge>
                </div>
                {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><UsersIcon className="h-3 w-3" />{r.users_count} {r.users_count === 1 ? "user" : "users"}</span>
                  <span>{r.permissions.length} permissions</span>
                </div>
              </button>
            ))}
          </div>

          {/* ── Permission grid ── */}
          {selected && (
            <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <p className="font-semibold">{selected.label}</p>
                  <p className="text-xs text-muted-foreground">
                    <code>{selected.name}</code> · {selected.audience === "customer" ? "customer account pages" : "vendor panel pages"}
                  </p>
                </div>
                {!canEdit && (
                  <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Only the Platform Owner can change roles</Badge>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Page</th>
                      {ACTIONS.map((a) => {
                        const names = columnPerms(a);
                        return (
                          <th key={a} className="w-24 px-2 py-2.5 text-center font-medium capitalize">
                            <label className={cn("inline-flex items-center gap-1.5", !locked && "cursor-pointer")}>
                              <Checkbox
                                checked={allOn(names) ? true : someOn(names) ? "indeterminate" : false}
                                disabled={locked || !names.length}
                                onCheckedChange={(v) => toggle(names, !!v)}
                                aria-label={`All ${a}`}
                              />
                              {a}
                            </label>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((g) => {
                      const rowNames = Object.values(g.permissions);
                      return (
                        <tr key={`${g.audience}-${g.slug}`} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5">
                            <label className={cn("flex items-center gap-2", !locked && "cursor-pointer")}>
                              <Checkbox
                                checked={allOn(rowNames) ? true : someOn(rowNames) ? "indeterminate" : false}
                                disabled={locked}
                                onCheckedChange={(v) => toggle(rowNames, !!v)}
                                aria-label={`All of ${g.name}`}
                              />
                              <span className="font-medium">{g.name}</span>
                            </label>
                          </td>
                          {ACTIONS.map((a) => {
                            const name = g.permissions[a];
                            return (
                              <td key={a} className="px-2 py-2.5 text-center">
                                {name ? (
                                  <Checkbox
                                    checked={draft.has(name)}
                                    disabled={locked}
                                    onCheckedChange={(v) => toggle([name], !!v)}
                                    aria-label={`${g.name} ${a}`}
                                    title={name}
                                  />
                                ) : <span className="text-muted-foreground/40">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!locked && (
                <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {changes ? `${changes} unsaved ${changes === 1 ? "change" : "changes"} — applies to every shop's ${selected.label.toLowerCase()}s.` : "No changes."}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!changes || save.isPending} onClick={() => setDraft(new Set(selected.permissions))}>Reset</Button>
                    <Button size="sm" disabled={!changes || save.isPending} onClick={() => save.mutate()}>
                      {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save changes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
