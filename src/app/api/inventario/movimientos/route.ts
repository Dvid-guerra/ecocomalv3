import type { NextRequest } from "next/server";
import { z } from "zod";
import { autenticar, ErrorApi, ROLES_OPERATIVOS, verificarMismoOrigen } from "@/lib/api-auth";
import { jsonError, jsonOk, leerJson } from "@/lib/api-respuesta";
import {
  MovimientoInvalidoError,
  StockMaterialInsuficienteError,
  type MovimientoInput,
} from "@/features/inventory/domain/movimientos";
import {
  esquemaMovimiento,
  MaterialNoEncontradoError,
  personaActiva,
  registrarMovimiento,
} from "@/features/inventory/server/movimientos";

const esquema = esquemaMovimiento.extend({
  /** Punto de registro: la persona que sacó o metió el material (la sesión es de la tablet). */
  realizadoPorId: z.string().min(1).max(128).optional(),
  origen: z.enum(["ui", "kiosko"]).default("ui"),
});

export async function POST(request: NextRequest) {
  try {
    verificarMismoOrigen(request);
    const sesion = await autenticar(request, ROLES_OPERATIVOS);

    const parsed = esquema.safeParse(await leerJson(request));
    if (!parsed.success) return jsonError("Datos del movimiento inválidos.", 400);
    const { realizadoPorId, origen, ...input } = parsed.data;

    const persona = { uid: sesion.uid, nombre: sesion.nombre };
    let usuario = persona;
    if (realizadoPorId && realizadoPorId !== sesion.uid) {
      const otra = await personaActiva(realizadoPorId);
      if (!otra) return jsonError("La persona seleccionada no existe o está inactiva.", 400);
      usuario = otra;
    }

    const resultado = await registrarMovimiento(input as MovimientoInput, {
      usuario,
      registradoPor: persona,
      origen,
    });
    return jsonOk({ resultado });
  } catch (error) {
    if (error instanceof ErrorApi) return jsonError(error.message, error.status);
    if (error instanceof StockMaterialInsuficienteError) {
      return jsonError(error.message, 409, { codigo: "stock_insuficiente", disponible: error.disponible });
    }
    if (error instanceof MovimientoInvalidoError) return jsonError(error.message, 400);
    if (error instanceof MaterialNoEncontradoError) return jsonError(error.message, 404);
    console.error("[inventario] Error al registrar movimiento:", error);
    return jsonError("No se pudo registrar el movimiento.", 500);
  }
}
