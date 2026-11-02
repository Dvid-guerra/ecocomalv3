import { Suspense } from "react";

/**
 * Layout para el grupo de rutas (auth).
 * El Suspense boundary es necesario porque login/page.tsx usa useSearchParams().
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
