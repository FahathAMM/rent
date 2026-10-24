import api from "@/lib/axios";

export const vendorInquiryService = {
  getAll: (params) => api.get("/vendor/inquiries", { params }),
  reply: (inquiryId, replyMessage) => api.post(`/vendor/inquiries/${inquiryId}/reply`, { reply_message: replyMessage }),
};
