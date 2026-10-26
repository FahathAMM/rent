import api from "@/lib/axios";

/** The public marketplace catalogue — see routes/public.php on the backend. No auth required. */
export const publicService = {
  vehicles: (params) => api.get("/public/vehicles", { params }),
  vehicle: (slug) => api.get(`/public/vehicles/${slug}`),
  vehicleReviews: (slug, params) => api.get(`/public/vehicles/${slug}/reviews`, { params }),
  shops: (params) => api.get("/public/shops", { params }),
  shop: (slug) => api.get(`/public/shops/${slug}`),
  shopVehicles: (slug, params) => api.get(`/public/shops/${slug}/vehicles`, { params }),
  shopReviews: (slug, params) => api.get(`/public/shops/${slug}/reviews`, { params }),
  categories: () => api.get("/public/categories"),
  heroSlides: () => api.get("/public/hero-slides"),
  brands: () => api.get("/public/brands"),
  models: (brandId) => api.get("/public/models", { params: { brand_id: brandId } }),
  variants: (modelId) => api.get("/public/variants", { params: { model_id: modelId } }),
  colours: () => api.get("/public/colours"),
  locations: () => api.get("/public/locations"),
  districts: () => api.get("/public/districts"),
  sendInquiry: (data) => api.post("/public/inquiries", data),
};
