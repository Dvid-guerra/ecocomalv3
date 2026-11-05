import type { EstadoPedido, Pedido } from "@/types";
import { ErrorRespuestaApi, postJson } from "@/lib/api-cliente";

export interface FaltanteProduccion {
  materialId: string;
  nombre: string;
  requerido: number;
  actual: number;
}

export class RecetaNoConfiguradaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecetaNoConfiguradaError";
  }
}

/**
 * Cambia el estado del pedido en el servidor. Al pasar a "En Producción" descuenta
 * los materiales de la receta; si falta material no cambia nada y devuelve los faltantes.
 */
export async function actualizarEstadoPedido(
  pedido: Pick<Pedido, "id">,
  nuevoEstado: EstadoPedido,
): Promise<FaltanteProduccion[]> {
  try {
    const { faltantes } = await postJson<{ faltantes: FaltanteProduccion[] }>(
      `/api/pedidos/${encodeURIComponent(pedido.id)}/estado`,
      { estado: nuevoEstado },
    );
    return faltantes;
  } catch (error) {
    if (error instanceof ErrorRespuestaApi && error.codigo === "receta_no_configurada") {
      throw new RecetaNoConfiguradaError(error.message);
    }
    throw error;
  }
}
