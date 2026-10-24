import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The active shop context for the vendor app — mirrors the backend's
 * VendorContext, except here it's just "which shop is the switcher set
 * to" (a UI preference), not an authorization boundary. The backend
 * re-validates X-Shop-Id against the caller's own shop_members rows on
 * every request regardless of what this store holds — see
 * ResolveShopContext and app-doc/marketplace/03-permissions-model.md
 * "Layer 2". Setting this to a shop the user isn't a member of just
 * gets every vendor request rejected with 403, it can't leak anything.
 */
export const useShopStore = create(
  persist(
    (set, get) => ({
      activeShopId: null,
      shops: [], // [{ shop_id, role }, ...] — refreshed from GET /auth/me on login

      setShops: (shops) => {
        const current = get().activeShopId;
        const stillValid = shops.some((s) => String(s.shop_id) === String(current));
        const next = stillValid ? current : shops[0]?.shop_id ?? null;
        set({ shops, activeShopId: next });
        if (typeof window !== "undefined") {
          if (next) localStorage.setItem("active_shop_id", String(next));
          else localStorage.removeItem("active_shop_id");
        }
      },

      setActiveShop: (shopId) => {
        set({ activeShopId: shopId });
        if (typeof window !== "undefined") {
          if (shopId) localStorage.setItem("active_shop_id", String(shopId));
          else localStorage.removeItem("active_shop_id");
        }
      },

      clear: () => {
        set({ activeShopId: null, shops: [] });
        if (typeof window !== "undefined") localStorage.removeItem("active_shop_id");
      },
    }),
    {
      name: "shop-context",
      partialize: (state) => ({ activeShopId: state.activeShopId, shops: state.shops }),
    }
  )
);
