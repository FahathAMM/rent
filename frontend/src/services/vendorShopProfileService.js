import api from "@/lib/axios";

export const vendorShopProfileService = {
  show: () => api.get("/vendor/shop-profile"),
  update: (data) => api.put("/vendor/shop-profile", data),
  /** FormData with logo / cover_image files, or remove_logo / remove_cover_image = 1. */
  updateBranding: (data) => api.post("/vendor/shop-profile/branding", data, { headers: { "Content-Type": "multipart/form-data" } }),
};
