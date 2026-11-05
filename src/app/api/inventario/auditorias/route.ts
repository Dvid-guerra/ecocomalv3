import type { NextRequest } from "next/server";
import { autenticar, ErrorApi, ROLES_OPERATIVOS, verificarMismoOrigen } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/api-respuesta";
import { ErrorAuditoria, iniciarAuditoria } from "@/features/inventory/server/auditorias";

/** Abre la auditoría mensual de inventario. */
export async function POST(request: NextRequest) {
  try {
    verificarMismoOrigen(request);
    const sesion = await autenticar(request, ROLES_OPERATIVOS);
    return jsonOk(await iniciarAuditoria({ uid: sesion.uid, nombre: sesion.nombre }));
  } catch (error) {
    if (error instanceof ErrorApi || error instanceof ErrorAuditoria) return jsonError(error.message, error.status);
    console.error("[auditoria] Error al iniciar:", error);
    return jsonError("No se pudo iniciar la auditoría.", 500);
  }
}
