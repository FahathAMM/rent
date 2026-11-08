"use client";

import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

function ContactItem({ icon: Icon, label, value, href }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-5 text-left">
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {href ? (
          <a href={href} className="mt-1 block break-words text-sm text-muted-foreground hover:text-foreground hover:underline">{value}</a>
        ) : (
          <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

/** The support details managed under Help & Support in the platform admin. Blank ones are left out. */
export function SupportContactDetails() {
  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const items = [
    brand?.support_email && { icon: Mail, label: "Email", value: brand.support_email, href: `mailto:${brand.support_email}` },
    brand?.support_phone && { icon: Phone, label: "Phone", value: brand.support_phone, href: `tel:${brand.support_phone.replace(/[^\d+]/g, "")}` },
    brand?.support_whatsapp && { icon: MessageCircle, label: "WhatsApp", value: brand.support_whatsapp, href: `https://wa.me/${brand.support_whatsapp.replace(/\D/g, "")}` },
    brand?.support_address && { icon: MapPin, label: "Address", value: brand.support_address },
    brand?.support_hours && { icon: Clock, label: "Support hours", value: brand.support_hours },
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-8 text-center text-xl font-semibold tracking-tight">Talk to our team</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <ContactItem key={item.label} {...item} />)}
        </div>
      </div>
    </div>
  );
}
