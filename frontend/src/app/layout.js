import { Inter, Noto_Sans_Tamil } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "@/lib/globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });
// Fallback for Tamil glyphs. Its @font-face is limited to the Tamil unicode
// range, so English-only pages never download it; preload is off for the same reason.
const notoTamil = Noto_Sans_Tamil({ subsets: ["tamil"], preload: false });

export const metadata = {
  title: {
    default: "LankaLane — Rent or buy vehicles from trusted shops across Sri Lanka",
    template: "%s | LankaLane",
  },
  description: "Compare, rent and buy cars, vans and SUVs from verified shops across Sri Lanka.",
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={inter.className}
        style={{ fontFamily: `${inter.style.fontFamily}, ${notoTamil.style.fontFamily}, sans-serif` }}
      >
        <NextIntlClientProvider>
          <Providers>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
