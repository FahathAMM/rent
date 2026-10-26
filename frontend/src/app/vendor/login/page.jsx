import LoginPageClient from "@/app/(auth)/login/LoginPageClient";
import { getInitialBrand } from "@/app/(auth)/getInitialBrand";

export default async function VendorLoginPage() {
  const initialBrand = await getInitialBrand();
  return <LoginPageClient initialBrand={initialBrand} initialView="login" audience="vendor" />;
}
