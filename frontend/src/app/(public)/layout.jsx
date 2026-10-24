import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

/**
 * Every customer-visit marketing/browsing page (home, browse, vehicle
 * detail, locations, shops, how-it-works) shares this shell — one
 * header, one footer — instead of each page rebuilding its own. Nested
 * inside the root layout.js as usual; the (public) segment itself never
 * appears in the URL.
 */
export default function PublicLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
