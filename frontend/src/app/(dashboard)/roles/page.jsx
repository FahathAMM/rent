"use client";

import { Fragment, useState, useMemo } from "react";
import { useRoles, usePermissionGroups, useCreateRole, useUpdateRole, useDeleteRole } from "@/hooks/useRoles";
import { useMenusFlat } from "@/hooks/useMenus";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, ShieldCheck, Users, Eye } from "lucide-react";
import { getIcon } from "@/lib/iconMap";
import { cn } from "@/lib/utils";

// permissionGroups is now an array of { menu_id, name, slug, icon, permissions: [{id, name}] }

function actionLabel(permName, slug) {
  return permName.replace(slug, "").trim();
}
function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const SYSTEM_ROLES = ["admin", "staff", "super-admin"];
const ACTIONS = ["view", "create", "edit", "delete"];

function GroupIcon({ icon }) {
  if (!icon) return null;
  const Icon = getIcon(icon);
  return <Icon className="h-3 w-3 text-muted-foreground shrink-0" />;
}

// Classifies flat permission groups (one per leaf menu) into modules using
// each leaf menu's parent. A leaf with no parent is its own module.
function buildModuleTree(permissionGroups, allMenus) {
  if (!permissionGroups) return [];
  const menuById = new Map((allMenus ?? []).map((m) => [m.id, m]));
  const modules = new Map();

  permissionGroups.forEach((group) => {
    const menu = group.menu_id ? menuById.get(group.menu_id) : null;
    const parent = menu?.parent_id ? menuById.get(menu.parent_id) : null;
    const key = parent ? `p-${parent.id}` : `g-${group.slug}`;

    if (!modules.has(key)) {
      modules.set(key, {
        key,
        name: parent ? parent.name : group.name,
        icon: parent ? parent.icon : group.icon,
        hasParent: !!parent,
        children: [],
      });
    }
    modules.get(key).children.push(group);
  });

  return [...modules.values()];
}

function RoleFormDialog({ open, onOpenChange, role, permissionGroups, allMenus }) {
  const isEdit = !!role;
  const create = useCreateRole();
  const update = useUpdateRole();

  const [name, setName] = useState(role?.name ?? "");
  const [selected, setSelected] = useState(() => new Set(role?.permissions ?? []));

  useMemo(() => {
    setName(role?.name ?? "");
    setSelected(new Set(role?.permissions ?? []));
  }, [role]);

  const moduleTree = useMemo(
    () => buildModuleTree(permissionGroups, allMenus),
    [permissionGroups, allMenus]
  );

  const isPending = create.isPending || update.isPending;

  const togglePerm = (permName) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(permName) ? next.delete(permName) : next.add(permName);
      return next;
    });

  const toggleGroup = (perms) => {
    const allChecked = perms.every((p) => selected.has(p.name));
    setSelected((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => (allChecked ? next.delete(p.name) : next.add(p.name)));
      return next;
    });
  };

  const toggleModule = (children) => toggleGroup(children.flatMap((g) => g.permissions));

  const toggleColumn = (action) => {
    const perms = permissionGroups
      .map((g) => g.permissions.find((p) => p.name === `${g.slug}-${action}`))
      .filter(Boolean);
    const allChecked = perms.every((p) => selected.has(p.name));
    setSelected((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => (allChecked ? next.delete(p.name) : next.add(p.name)));
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: name.trim(), permissions: [...selected] };
    try {
      if (isEdit) await update.mutateAsync({ id: role.id, data: payload });
      else await create.mutateAsync(payload);
      onOpenChange(false);
    } catch { /* toast handled in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-x-hidden overflow-y-auto p-4">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-sm font-semibold">
            {isEdit ? `Edit Role: ${role.name}` : "Create New Role"}
          </DialogTitle>
        </DialogHeader>

        {/* DialogContent is `display: grid`, and a grid item's default
        `min-width: auto` lets it size to its widest descendant (the 520px
        permissions table) instead of shrinking to the grid track — silently
        ballooning past the dialog's own boundary regardless of any
        overflow-x-auto set further down. min-w-0 overrides that default. */}
        <form onSubmit={handleSubmit} className="min-w-0 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Role Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. supervisor"
              required
              disabled={isEdit && SYSTEM_ROLES.includes(role.name)}
              className="h-8 text-xs"
            />
            {isEdit && SYSTEM_ROLES.includes(role.name) && (
              <p className="text-[11px] text-muted-foreground">System role names cannot be changed.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Permissions</label>
            {!permissionGroups ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="w-full max-h-[45vh] overflow-y-auto overflow-x-auto border rounded">
                {/* Two things had to be true together for this to scroll on a
                narrow screen: the table needs a forced min-width (otherwise
                the table layout just shrinks every column to fit, and the
                last column's label bleeds past the edge with nothing to
                scroll into) — and THIS wrapper needs its own `w-full` cap
                (otherwise it just grows to match the table instead of being
                narrower than it, so overflow-x-auto never has anything to
                do; it only activates when the element is narrower than its
                own content). */}
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Module</TableHead>
                      {ACTIONS.map((action) => (
                        <TableHead key={action} className="text-xs text-center capitalize">
                          <button
                            type="button"
                            onClick={() => toggleColumn(action)}
                            className="capitalize hover:text-foreground"
                          >
                            {action}
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moduleTree.map((mod) => {
                      const modulePerms = mod.children.flatMap((g) => g.permissions);
                      const modAllChecked = modulePerms.every((p) => selected.has(p.name));
                      const modSomeChecked = modulePerms.some((p) => selected.has(p.name));
                      return (
                        <Fragment key={mod.key}>
                          {mod.hasParent && (
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableCell colSpan={1 + ACTIONS.length} className="py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Checkbox
                                    id={`mod-${mod.key}`}
                                    checked={modAllChecked ? true : modSomeChecked ? "indeterminate" : false}
                                    onCheckedChange={() => toggleModule(mod.children)}
                                    className="h-3.5 w-3.5"
                                  />
                                  <GroupIcon icon={mod.icon} />
                                  <label
                                    htmlFor={`mod-${mod.key}`}
                                    className="text-xs font-semibold capitalize cursor-pointer select-none whitespace-nowrap"
                                  >
                                    {mod.name}
                                  </label>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {mod.children.map((group) => {
                            const { slug, name: groupName, icon, permissions: perms } = group;
                            const allChecked = perms.every((p) => selected.has(p.name));
                            const someChecked = perms.some((p) => selected.has(p.name));
                            return (
                              <TableRow key={slug}>
                                <TableCell className={cn("text-xs", mod.hasParent && "pl-6")}>
                                  <div className="flex items-center gap-1.5">
                                    <Checkbox
                                      id={`group-${slug}`}
                                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                                      onCheckedChange={() => toggleGroup(perms)}
                                      className="h-3.5 w-3.5"
                                    />
                                    {!mod.hasParent && <GroupIcon icon={icon} />}
                                    <label
                                      htmlFor={`group-${slug}`}
                                      className="font-medium capitalize cursor-pointer select-none whitespace-nowrap"
                                    >
                                      {groupName}
                                    </label>
                                  </div>
                                </TableCell>
                                {ACTIONS.map((action) => {
                                  const perm = perms.find((p) => p.name === `${slug}-${action}`);
                                  return (
                                    <TableCell key={action} className="text-center">
                                      {perm ? (
                                        <Checkbox
                                          id={`perm-${perm.id}`}
                                          checked={selected.has(perm.name)}
                                          onCheckedChange={() => togglePerm(perm.name)}
                                          className="h-3.5 w-3.5"
                                        />
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="pt-1 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RolePermissionsDialog({ open, onOpenChange, role, moduleTree }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[95vh] flex flex-col p-4">
        <DialogHeader className="pb-1 shrink-0">
          <DialogTitle className="text-sm font-semibold capitalize">
            {role?.name} · Permissions
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">

        {moduleTree.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">No permissions assigned</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Module</TableHead>
                <TableHead className="text-xs">Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moduleTree.map((mod) => (
                <Fragment key={mod.key}>
                  {mod.hasParent && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={2} className="py-1.5">
                        <div className="flex items-center gap-1">
                          <GroupIcon icon={mod.icon} />
                          <span className="text-xs font-semibold capitalize">{mod.name}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {mod.children.map((group) => (
                    <TableRow key={group.slug}>
                      <TableCell className={cn("align-top text-xs font-medium capitalize whitespace-nowrap", mod.hasParent && "pl-6")}>
                        <div className="flex items-center gap-1">
                          {!mod.hasParent && <GroupIcon icon={group.icon} />}
                          {group.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {group.permissions.map((p) => (
                            <Badge key={p.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize font-normal">
                              {cap(actionLabel(p.name, group.slug))}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoleCard({ role, permissionGroups, allMenus, onEdit, onDelete }) {
  const isSystem = SYSTEM_ROLES.includes(role.name);
  const [viewOpen, setViewOpen] = useState(false);

  const grouped = useMemo(() => {
    if (!permissionGroups) return [];
    return permissionGroups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((p) => role.permissions.includes(p.name)),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [role.permissions, permissionGroups]);

  const moduleTree = useMemo(() => buildModuleTree(grouped, allMenus), [grouped, allMenus]);

  const permCount = role.permissions?.length ?? 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="shrink-0 rounded bg-primary/10 p-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold capitalize truncate">{role.name}</p>
              {isSystem && (
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">System role</p>
              )}
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
          <Users className="h-3 w-3" />
          {role.users_count} {role.users_count === 1 ? "user" : "users"}
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 flex-1 flex items-end">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] w-full"
          onClick={() => setViewOpen(true)}
        >
          <Eye className="h-3 w-3" />
          {permCount} {permCount === 1 ? "Permission" : "Permissions"}
        </Button>
      </CardContent>

      <RolePermissionsDialog open={viewOpen} onOpenChange={setViewOpen} role={role} moduleTree={moduleTree} />
    </Card>
  );
}

export default function RolesPage() {
  const { data: roles, isLoading } = useRoles();
  const { data: permissionGroups } = usePermissionGroups();
  const { data: allMenus } = useMenusFlat();
  const deleteRole = useDeleteRole();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (role) => { setEditTarget(role); setFormOpen(true); };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate}><Plus />New Role</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {(roles ?? []).map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              permissionGroups={permissionGroups}
              allMenus={allMenus}
              onEdit={() => openEdit(role)}
              onDelete={() => setDeleteTarget(role)}
            />
          ))}
        </div>
      )}

      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={editTarget}
        permissionGroups={permissionGroups}
        allMenus={allMenus}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Role"
        description={
          SYSTEM_ROLES.includes(deleteTarget?.name)
            ? `"${deleteTarget?.name}" is a system role and cannot be deleted.`
            : `Delete role "${deleteTarget?.name}"? Users with this role will lose it.`
        }
        onConfirm={() =>
          !SYSTEM_ROLES.includes(deleteTarget?.name) &&
          deleteRole.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }
        loading={deleteRole.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
