import VendorLoginPageClient from "../_auth/VendorLoginPageClient";
import { getInitialBrand } from "@/lib/getInitialBrand";

export default async function VendorLoginPage() {
  const initialBrand = await getInitialBrand();
  return <VendorLoginPageClient initialBrand={initialBrand} initialView="login" />;
}
