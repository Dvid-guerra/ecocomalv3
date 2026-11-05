import type { NextRequest } from "next/server";
import { z } from "zod";
import { autenticar, ErrorApi, ROLES_OPERATIVOS, verificarMismoOrigen } from "@/lib/api-auth";
import { jsonError, jsonOk, leerJson } from "@/lib/api-respuesta";
import type { Rol } from "@/types";
import {
  cancelarAuditoria,
  cerrarAuditoria,
  ErrorAuditoria,
  registrarConteo,
} from "@/features/inventory/server/auditorias";
import { MovimientoInvalidoError, StockMaterialInsuficienteError } from "@/features/inventory/domain/movimientos";

const esquema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("contar"), materialId: z.string().min(1).max(128), contado: z.number() }),
  z.object({ accion: z.literal("cerrar") }),
  z.object({ accion: z.literal("cancelar") }),
]);

const PUEDEN_CANCELAR: readonly Rol[] = ["Gerente", "Subgerente"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    verificarMismoOrigen(request);
    const sesion = await autenticar(request, ROLES_OPERATIVOS);
    const persona = { uid: sesion.uid, nombre: sesion.nombre };
    const { id } = await params;

    const parsed = esquema.safeParse(await leerJson(request));
    if (!parsed.success) return jsonError("Solicitud inválida.", 400);
    const cuerpo = parsed.data;

    if (cuerpo.accion === "contar") {
      await registrarConteo(id, cuerpo.materialId, cuerpo.contado, persona);
      return jsonOk({ ok: true });
    }
    if (cuerpo.accion === "cerrar") {
      return jsonOk({ totales: await cerrarAuditoria(id, persona) });
    }
    if (!PUEDEN_CANCELAR.includes(sesion.rol)) return jsonError("Solo Gerencia puede cancelar una auditoría.", 403);
    await cancelarAuditoria(id, persona);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof ErrorApi || error instanceof ErrorAuditoria) return jsonError(error.message, error.status);
    if (error instanceof StockMaterialInsuficienteError || error instanceof MovimientoInvalidoError) {
      return jsonError(error.message, 409);
    }
    console.error("[auditoria] Error:", error);
    return jsonError("No se pudo completar la acción de la auditoría.", 500);
  }
}
