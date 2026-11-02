import "server-only";
import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { Rol } from "@/types";

const COOKIE_NAME = "ecocomal_session";

export interface UsuarioApi {
  uid: string;
  nombre: string;
  rol: Rol;
}

export class ErrorApi extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ErrorApi";
    this.status = status;
  }
}

/** Rechaza solicitudes de otros sitios (protección CSRF básica). */
export function verificarMismoOrigen(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ErrorApi("Origen de solicitud no permitido.", 403);
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ErrorApi("Origen de solicitud no permitido.", 403);
  }
}

/** Verifica la cookie de sesión, que la cuenta esté activa y que tenga uno de los roles. */
export async function autenticar(request: NextRequest, roles: readonly Rol[]): Promise<UsuarioApi> {
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) throw new ErrorApi("Debes iniciar sesión.", 401);

  let uid: string;
  try {
    uid = (await adminAuth.verifySessionCookie(cookie, true)).uid;
  } catch {
    throw new ErrorApi("La sesión no es válida o expiró.", 401);
  }

  const perfil = await adminDb.collection("usuarios").doc(uid).get();
  const data = perfil.data();
  if (!perfil.exists || data?.activo !== true) {
    throw new ErrorApi("La cuenta está inactiva o no tiene perfil.", 403);
  }
  if (!roles.includes(data.rol)) {
    throw new ErrorApi("No tienes permisos para esta acción.", 403);
  }
  return { uid, nombre: String(data.nombre ?? ""), rol: data.rol };
}

export const ROLES_OPERATIVOS: readonly Rol[] = ["Gerente", "Subgerente", "Supervisor"];
