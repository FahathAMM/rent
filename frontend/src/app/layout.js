import { Inter } from "next/font/google";
import "@/lib/globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: {
    default: "LankaLane — Rent or buy vehicles from trusted shops across Sri Lanka",
    template: "%s | LankaLane",
  },
  description: "Compare, rent and buy cars, vans and SUVs from verified shops across Sri Lanka.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
