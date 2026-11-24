import type { Rol } from "@/types";

/**
 * Fuente única de la política de acceso por ruta.
 *
 * La usan las tres capas que deben coincidir:
 *   - `src/proxy.ts`                  → corta en el borde (autoridad real).
 *   - `src/app/dashboard/layout.tsx`  → evita montar la página y que sus
 *                                       listeners de Firestore se disparen.
 *   - `src/app/dashboard/page.tsx`    → decide qué tarjeta del hub se bloquea.
 *
 * Los roles de cada módulo reflejan lo que ya exige `firestore.rules`: casi todo
 * el dashboard pide `operational()` (Gerente, Subgerente, Supervisor) y Finanzas
 * pide `manager()` (solo Gerente). El rol vive en Firestore, nunca en la cookie.
 */

/** Los cuatro roles válidos, para validar lo que venga de Firestore. */
export const ROLES: readonly Rol[] = ["Gerente", "Subgerente", "Supervisor", "Colaborador"];

/** Valida un `rol` leído de Firestore antes de decidir accesos con él. */
export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

/** Gerente, Subgerente y Supervisor: el `operational()` de las reglas. */
export const ROLES_OPERATIVOS: readonly Rol[] = ["Gerente", "Subgerente", "Supervisor"];

/** Solo Gerente: el `manager()` de las reglas. */
export const ROLES_GERENCIA: readonly Rol[] = ["Gerente"];

/**
 * Prefijo de ruta → roles con acceso. El orden importa: se evalúa el primer
 * prefijo que case, así que los más específicos van antes.
 */
const POLITICA: readonly { prefijo: string; roles: readonly Rol[] }[] = [
  { prefijo: "/dashboard/finanzas", roles: ROLES_GERENCIA },
  { prefijo: "/dashboard/planta", roles: ROLES_OPERATIVOS },
  { prefijo: "/dashboard/administracion", roles: ROLES_OPERATIVOS },
  { prefijo: "/dashboard/ventas", roles: ROLES_OPERATIVOS },
  { prefijo: "/dashboard/entregas", roles: ROLES_OPERATIVOS },
  { prefijo: "/dashboard/inventario", roles: ROLES_OPERATIVOS },
  // El hub `/dashboard` se deja al final: cualquier ruta del dashboard que no
  // esté arriba queda igualmente cerrada a Colaboradores.
  { prefijo: "/dashboard", roles: ROLES_OPERATIVOS },
];

/** Roles con acceso a una ruta, o `null` si la ruta no está bajo la política. */
export function rolesDeRuta(pathname: string): readonly Rol[] | null {
  const regla = POLITICA.find(
    r => pathname === r.prefijo || pathname.startsWith(`${r.prefijo}/`),
  );
  return regla?.roles ?? null;
}

/** `true` si el rol puede entrar a la ruta (o si la ruta no está regulada). */
export function puedeEntrar(rol: Rol, pathname: string): boolean {
  const roles = rolesDeRuta(pathname);
  return roles === null || roles.includes(rol);
}

/**
 * A dónde mandar a quien no tiene acceso.
 *
 * El Colaborador no pertenece al dashboard: su sitio es el portal, así que
 * mandarlo al hub solo lo dejaría rebotando. Los demás roles sí viven en el
 * dashboard, y el hub ya sabe mostrar el aviso con `?acceso=denegado`.
 */
export function destinoSinAcceso(rol: Rol): string {
  return rol === "Colaborador" ? "/empleado/portal" : "/dashboard?acceso=denegado";
}
