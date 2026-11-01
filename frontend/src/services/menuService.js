import api from "@/lib/axios";

export const menuService = {
  navigation: (audience = "vendor") => api.get("/menus/navigation", { params: { audience } }),
};
