import api from "@/lib/axios";

/** The public marketplace catalogue — see routes/public.php on the backend. No auth required. */
export const publicService = {
  vehicles: (params) => api.get("/public/vehicles", { params }),
  vehicle: (slug) => api.get(`/public/vehicles/${slug}`),
  vehicleReviews: (slug, params) => api.get(`/public/vehicles/${slug}/reviews`, { params }),
  shops: (params) => api.get("/public/shops", { params }),
  shop: (slug) => api.get(`/public/shops/${slug}`),
  shopVehicles: (slug, params) => api.get(`/public/shops/${slug}/vehicles`, { params }),
  categories: () => api.get("/public/categories"),
};
