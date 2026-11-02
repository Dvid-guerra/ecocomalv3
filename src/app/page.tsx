import { redirect } from "next/navigation";

/** La raíz del sitio redirige directamente al login. */
export default function RootPage() {
  redirect("/login");
}
