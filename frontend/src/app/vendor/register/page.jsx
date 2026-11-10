import { Suspense } from "react";
import VendorLoginPageClient from "../_auth/VendorLoginPageClient";
import { getInitialBrand } from "@/lib/getInitialBrand";

export default async function VendorRegisterPage() {
  const initialBrand = await getInitialBrand();
  return (
    <Suspense>
      <VendorLoginPageClient initialBrand={initialBrand} initialView="register" />
    </Suspense>
  );
}
