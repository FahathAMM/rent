import platformApi from "@/lib/platformAxios";

/** The vehicle hierarchy under brands: models (per brand), variants (per model) and colours. */
export const platformVehicleModelService = {
  getAll: (params) => platformApi.get("/platform/vehicle-models", { params }),
  create: (data) => platformApi.post("/platform/vehicle-models", data),
  update: (id, data) => platformApi.put(`/platform/vehicle-models/${id}`, data),
  delete: (id) => platformApi.delete(`/platform/vehicle-models/${id}`),
};

export const platformVehicleVariantService = {
  getAll: (modelId) => platformApi.get("/platform/vehicle-variants", { params: { model_id: modelId } }),
  create: (data) => platformApi.post("/platform/vehicle-variants", data),
  update: (id, data) => platformApi.put(`/platform/vehicle-variants/${id}`, data),
  delete: (id) => platformApi.delete(`/platform/vehicle-variants/${id}`),
};

export const platformVehicleColourService = {
  getAll: () => platformApi.get("/platform/vehicle-colours"),
  create: (data) => platformApi.post("/platform/vehicle-colours", data),
  update: (id, data) => platformApi.put(`/platform/vehicle-colours/${id}`, data),
  delete: (id) => platformApi.delete(`/platform/vehicle-colours/${id}`),
};
