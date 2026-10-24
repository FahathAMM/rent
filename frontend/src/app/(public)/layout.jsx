import { PublicAuthProvider } from "@/components/public/PublicAuthProvider";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

/**
 * Every customer-visit marketing/browsing page (home, search, vehicle
 * detail) shares this shell — one header, one footer, one sign-in/sign-up
 * popup (PublicAuthProvider) — instead of each page rebuilding its own.
 * Nested inside the root layout.js as usual; the (public) segment itself
 * never appears in the URL.
 */
export default function PublicLayout({ children }) {
  return (
    <PublicAuthProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHeader />
        <main className="flex-1">{children}</main>
        <PublicFooter />
      </div>
    </PublicAuthProvider>
  );
}
