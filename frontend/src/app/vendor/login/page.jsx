import VendorLoginPageClient from "../_auth/VendorLoginPageClient";
import { getInitialBrand } from "../_auth/getInitialBrand";

export default async function VendorLoginPage() {
  const initialBrand = await getInitialBrand();
  return <VendorLoginPageClient initialBrand={initialBrand} initialView="login" />;
}
