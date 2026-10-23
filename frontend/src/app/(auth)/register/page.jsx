import LoginPageClient from "../login/LoginPageClient";
import { getInitialBrand } from "../getInitialBrand";

export default async function RegisterPage() {
  const initialBrand = await getInitialBrand();
  return <LoginPageClient initialBrand={initialBrand} initialView="register" />;
}
