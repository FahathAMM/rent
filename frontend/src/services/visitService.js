import api from "@/lib/axios";
import customerApi from "@/lib/customerAxios";

const path = () => (typeof window !== "undefined" ? window.location.pathname : undefined);

// Fire-and-forget traffic logging (public page visits, vendor app page
// visits, login visits, link clicks) — backend writes
// storage/logs/public_visit/<date>.log and the public_visits table. Never blocks the UI.
export const visitService = {
  // Sent with the customer token (if signed in) so the visit records who it was.
  track: (type) =>
    customerApi
      .post("/visits", { type, path: path() })
      .catch(() => {}),

  // Vendor app pages — sent with the vendor (owner/staff) token so the
  // visit records the member and their shop.
  trackVendor: () =>
    api
      .post("/visits", { type: "vendor_visit", path: path() })
      .catch(() => {}),
};
