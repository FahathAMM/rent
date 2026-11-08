import { SectionHeader } from "@/components/public/SectionHeader";
import { ShopCard } from "@/components/marketplace/ShopCard";
import { ShopLogoMarquee } from "@/components/public/ShopLogoMarquee";

/** Three spotlight shops, then the rest in the logo marquee. */
export function TopShopsSection({ shops }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <SectionHeader eyebrow="Trusted partners" title="Top rated shops" subtitle="Verified shops with great reviews and responsive service." href="/shops" linkLabel="All shops" />
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {shops.slice(0, 3).map((shop) => (
          <div key={shop.id} className="w-[82%] shrink-0 snap-start sm:w-auto">
            <ShopCard shop={shop} />
          </div>
        ))}
      </div>
      {shops.length > 3 && (
        <div className="mt-6 sm:mt-10">
          <ShopLogoMarquee shops={shops} />
        </div>
      )}
    </section>
  );
}
