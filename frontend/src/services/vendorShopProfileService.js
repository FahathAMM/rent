import api from "@/lib/axios";

export const vendorShopProfileService = {
  show: () => api.get("/vendor/shop-profile"),
  update: (data) => api.put("/vendor/shop-profile", data),
};
