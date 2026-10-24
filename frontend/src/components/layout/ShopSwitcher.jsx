"use client";

import { useShopStore } from "@/store/shopStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, ChevronsUpDown, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const ROLE_LABEL = { owner: "Owner", manager: "Manager", staff: "Staff" };

/**
 * Lets a user who belongs to more than one shop pick which one every
 * vendor-side request acts for — see src/lib/axios.js (attaches
 * X-Shop-Id) and the backend's ResolveShopContext, which independently
 * re-validates whatever this is set to against the user's real
 * shop_members rows on every request. Picking a shop here can never grant
 * access to one the user isn't actually a member of.
 */
export function ShopSwitcher() {
  const { shops, activeShopId, setActiveShop } = useShopStore();
  const queryClient = useQueryClient();

  if (!shops?.length) return null;

  const active = shops.find((s) => String(s.shop_id) === String(activeShopId));

  if (shops.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="truncate">{shops[0].shop_name ?? `Shop #${shops[0].shop_id}`}</span>
      </div>
    );
  }

  const handleSelect = (shopId) => {
    setActiveShop(shopId);
    // Every vendor query is shop-scoped — switching shops invalidates
    // everything so stale data from the previous shop never flashes.
    queryClient.invalidateQueries();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{active?.shop_name ?? `Shop #${activeShopId}`}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch shop</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {shops.map((s) => (
          <DropdownMenuItem key={s.shop_id} onClick={() => handleSelect(s.shop_id)} className="justify-between">
            <span className="truncate">{s.shop_name ?? `Shop #${s.shop_id}`}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {ROLE_LABEL[s.role] ?? s.role}
              {String(s.shop_id) === String(activeShopId) && <Check className="h-3.5 w-3.5" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
