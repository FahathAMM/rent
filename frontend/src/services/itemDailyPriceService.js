import api from "@/lib/axios";

export const itemDailyPriceService = {
  getAll: (params) => api.get("/item-daily-prices", { params }),
  save: (prices) => api.post("/item-daily-prices", { prices }),
};
