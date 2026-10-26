import api from "@/lib/axios";

/** The all-vehicle availability calendar. */
export const vendorAvailabilityService = {
  getAll: (params) => api.get("/vehicles-availability", { params }),
  block: (vehicleId, data) => api.post(`/vehicles/${vehicleId}/availability/block`, data),
  unblock: (vehicleId, data) => api.post(`/vehicles/${vehicleId}/availability/unblock`, data),
};
