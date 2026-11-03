export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${backendUrl}/api/public/vehicles/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const v = json.data;
    if (!v) return {};

    const primaryImg = v.images?.find((i) => i.is_primary) || v.images?.[0];
    const imageUrl = primaryImg?.url || primaryImg?.attachment?.file_path
      ? (primaryImg.url || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/storage/${primaryImg.attachment.file_path}`)
      : undefined;

    return {
      title: `${v.title} — ${v.shop?.name || "LankaLane"}`,
      description: `Rent ${v.title} in ${v.shop?.city || "Sri Lanka"} for ${
        v.pricing?.daily_rate ? `LKR ${Number(v.pricing.daily_rate).toLocaleString()}/day` : "great rates"
      } on LankaLane.`,
      openGraph: {
        title: `${v.title} — Rent on LankaLane`,
        description: `Rent ${v.title} from ${v.shop?.name || "verified rental shop"} in ${
          v.shop?.city || "Sri Lanka"
        }.`,
        url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/vehicles/${v.slug}`,
        images: imageUrl ? [{ url: imageUrl, alt: v.title }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: v.title,
        description: `Rent from ${v.shop?.name || "LankaLane"}`,
        images: imageUrl ? [imageUrl] : [],
      },
    };
  } catch {
    return {};
  }
}

export default function VehicleSlugLayout({ children }) {
  return children;
}
