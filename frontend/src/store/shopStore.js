import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The vendor user's own shop — `{ shop_id, shop_name, role }` or null,
 * refreshed from GET /auth/me. One account belongs to at most one shop,
 * and the backend always acts for that shop (ResolveShopContext reads
 * users.shop_id), so this is display state only, never sent to the API.
 */
export const useShopStore = create(
  persist(
    (set) => ({
      shop: null,
      setShop: (shop) => set({ shop: shop ?? null }),
      clear: () => set({ shop: null }),
    }),
    {
      name: "shop-context",
      version: 1,
      // Older persisted state held a `shops` array + activeShopId; start clean.
      migrate: () => ({ shop: null }),
    }
  )
);
