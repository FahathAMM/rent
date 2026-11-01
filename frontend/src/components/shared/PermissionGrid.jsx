"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const ACTIONS = ["view", "create", "edit", "delete"];

/**
 * Pages × actions grid of permission checkboxes. `groups` is the
 * PermissionCatalogue shape ({ slug, name, permissions: { view: "vendor-…" } });
 * `selected` is a Set of permission names. Read-only when `disabled`.
 */
export function PermissionGrid({ groups, selected, onToggle, disabled = false }) {
  const allOn = (names) => names.length > 0 && names.every((n) => selected.has(n));
  const someOn = (names) => names.some((n) => selected.has(n));
  const state = (names) => (allOn(names) ? true : someOn(names) ? "indeterminate" : false);
  const column = (action) => groups.map((g) => g.permissions[action]).filter(Boolean);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 text-left font-medium">Page</th>
            {ACTIONS.map((a) => (
              <th key={a} className="w-20 px-2 py-2.5 text-center font-medium capitalize">
                <label className={cn("inline-flex items-center gap-1.5", !disabled && "cursor-pointer")}>
                  <Checkbox
                    checked={state(column(a))}
                    disabled={disabled || !column(a).length}
                    onCheckedChange={(v) => onToggle(column(a), !!v)}
                    aria-label={`All ${a}`}
                  />
                  {a}
                </label>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {groups.map((g) => {
            const row = Object.values(g.permissions);
            return (
              <tr key={g.slug} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <label className={cn("flex items-center gap-2", !disabled && "cursor-pointer")}>
                    <Checkbox checked={state(row)} disabled={disabled} onCheckedChange={(v) => onToggle(row, !!v)} aria-label={`All of ${g.name}`} />
                    <span className="font-medium">{g.name}</span>
                  </label>
                </td>
                {ACTIONS.map((a) => {
                  const name = g.permissions[a];
                  return (
                    <td key={a} className="px-2 py-2 text-center">
                      {name ? (
                        <Checkbox
                          checked={selected.has(name)}
                          disabled={disabled}
                          onCheckedChange={(v) => onToggle([name], !!v)}
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
  );
}
