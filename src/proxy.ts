import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { destinoSinAcceso, esRol, puedeEntrar } from "@/lib/acceso";

/**
 * Proxy de Next.js 16 (anteriormente middleware) que actúa como primera línea de defensa.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sesionCookie = request.cookies.get("ecocomal_session")?.value;

  const protegida = pathname.startsWith("/dashboard") || pathname.startsWith("/empleado");
  if (!protegida) return NextResponse.next();

  if (!sesionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sesionCookie, true);
    const profile = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const data = profile.data();

    if (!profile.exists || data?.activo !== true) throw new Error("Cuenta inactiva");

    const rol = data?.rol;
    if (!esRol(rol)) throw new Error("Rol no reconocido");

    if (!puedeEntrar(rol, pathname)) {
      return NextResponse.redirect(new URL(destinoSinAcceso(rol), request.nextUrl));
    }

    return NextResponse.next();
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    const response = NextResponse.redirect(url);
    response.cookies.delete("ecocomal_session");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Aplica el middleware a todas las rutas excepto las estáticas de Next.js.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
