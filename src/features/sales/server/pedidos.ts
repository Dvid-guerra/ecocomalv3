import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import type { EstadoPedido, Pedido, ProductoReceta } from "@/types";
import { calcularMaterialesRequeridos, recetaTieneMateriales } from "@/features/inventory/domain/recetas";
import { aplicarMovimientoEnTransaccion, type Persona } from "@/features/inventory/server/movimientos";

export const ESTADOS_PEDIDO = ["Cotización", "Confirmado", "En Producción", "Listo", "Entregado"] as const satisfies readonly EstadoPedido[];

export interface FaltanteProduccion {
  materialId: string;
  nombre: string;
  requerido: number;
  actual: number;
}

export class PedidoNoEncontradoError extends Error {
  constructor() {
    super("El pedido ya no existe.");
    this.name = "PedidoNoEncontradoError";
  }
}

export class RecetaNoConfiguradaError extends Error {
  constructor(modelo: string) {
    super(`No existe una receta completa para ${modelo}.`);
    this.name = "RecetaNoConfiguradaError";
  }
}

/**
 * Cambia el estado de un pedido. Al pasar a "En Producción" descuenta los materiales
 * de la receta en la misma transacción y deja cada salida en el historial.
 * Si falta material no cambia nada y devuelve los faltantes.
 */
export async function actualizarEstadoPedido(
  pedidoId: string,
  nuevoEstado: EstadoPedido,
  usuario: Persona,
): Promise<FaltanteProduccion[]> {
  const pedidoRef = adminDb.collection("pedidos").doc(pedidoId);

  return adminDb.runTransaction(async transaction => {
    const pedidoSnap = await transaction.get(pedidoRef);
    if (!pedidoSnap.exists) throw new PedidoNoEncontradoError();

    const pedido = { id: pedidoSnap.id, ...pedidoSnap.data() } as Pedido;
    if (nuevoEstado !== "En Producción" || pedido.estado === "En Producción") {
      transaction.update(pedidoRef, { estado: nuevoEstado });
      return [];
    }

    const recetaSnap = await transaction.get(adminDb.collection("recetas").doc(pedido.modelo));
    if (!recetaSnap.exists) throw new RecetaNoConfiguradaError(pedido.modelo);

    const receta = { id: recetaSnap.id, ...recetaSnap.data() } as ProductoReceta;
    // Sin materiales ligados no habría nada que descontar: se exige receta completa.
    if (!recetaTieneMateriales(receta)) throw new RecetaNoConfiguradaError(pedido.modelo);

    const requeridos = calcularMaterialesRequeridos(receta, pedido.cantidad);
    const refs = [...requeridos.keys()].map(id => adminDb.collection("materiales").doc(id));
    const snaps = refs.length ? await transaction.getAll(...refs) : [];

    const faltantes: FaltanteProduccion[] = [];
    for (const snap of snaps) {
      const actual = Number(snap.data()?.stockActual ?? 0);
      const requerido = requeridos.get(snap.id) ?? 0;
      if (actual < requerido) {
        faltantes.push({ materialId: snap.id, nombre: String(snap.data()?.nombre ?? snap.id), requerido, actual });
      }
    }
    if (faltantes.length) return faltantes;

    for (const snap of snaps) {
      const cantidad = requeridos.get(snap.id) ?? 0;
      if (cantidad <= 0) continue;
      aplicarMovimientoEnTransaccion(
        transaction,
        snap,
        {
          materialId: snap.id,
          tipo: "salida",
          cantidad,
          motivo: "consumo_produccion",
          nota: `${pedido.cantidad} × ${pedido.modelo} — ${pedido.clienteNombre}`,
          referencia: { tipo: "pedido", id: pedido.id },
        },
        { usuario, origen: "pedido" },
      );
    }
    transaction.update(pedidoRef, { estado: nuevoEstado });
    return [];
  });
}
