import LoginPageClient from "./LoginPageClient";
import { getInitialBrand } from "../getInitialBrand";

export default async function LoginPage() {
  const initialBrand = await getInitialBrand();
  return <LoginPageClient initialBrand={initialBrand} initialView="login" />;
}
