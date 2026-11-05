import type { NextRequest } from "next/server";
import { z } from "zod";
import { autenticar, ErrorApi, ROLES_OPERATIVOS, verificarMismoOrigen } from "@/lib/api-auth";
import { jsonError, jsonOk, leerJson } from "@/lib/api-respuesta";
import {
  actualizarEstadoPedido,
  ESTADOS_PEDIDO,
  PedidoNoEncontradoError,
  RecetaNoConfiguradaError,
} from "@/features/sales/server/pedidos";
import { MovimientoInvalidoError, StockMaterialInsuficienteError } from "@/features/inventory/domain/movimientos";

const esquema = z.object({ estado: z.enum(ESTADOS_PEDIDO) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    verificarMismoOrigen(request);
    const sesion = await autenticar(request, ROLES_OPERATIVOS);
    const { id } = await params;

    const parsed = esquema.safeParse(await leerJson(request));
    if (!parsed.success) return jsonError("Estado inválido.", 400);

    const faltantes = await actualizarEstadoPedido(id, parsed.data.estado, { uid: sesion.uid, nombre: sesion.nombre });
    return jsonOk({ faltantes });
  } catch (error) {
    if (error instanceof ErrorApi) return jsonError(error.message, error.status);
    if (error instanceof PedidoNoEncontradoError) return jsonError(error.message, 404);
    if (error instanceof RecetaNoConfiguradaError) return jsonError(error.message, 422, { codigo: "receta_no_configurada" });
    // Carrera: otro movimiento bajó el stock entre la verificación y el descuento.
    if (error instanceof StockMaterialInsuficienteError || error instanceof MovimientoInvalidoError) {
      return jsonError(error.message, 409);
    }
    console.error("[pedidos] Error al cambiar estado:", error);
    return jsonError("No se pudo actualizar el estado del pedido.", 500);
  }
}
