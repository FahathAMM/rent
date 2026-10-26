import { Suspense } from "react";
import LoginPageClient from "@/app/(auth)/login/LoginPageClient";
import { getInitialBrand } from "@/app/(auth)/getInitialBrand";

export default async function VendorRegisterPage() {
  const initialBrand = await getInitialBrand();
  return (
    <Suspense>
      <LoginPageClient initialBrand={initialBrand} initialView="register" audience="vendor" />
    </Suspense>
  );
}
