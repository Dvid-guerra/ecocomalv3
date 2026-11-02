import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EstadoPedido, Material, Pedido, ProductoReceta } from "@/types";
import { calcularMaterialesRequeridos, recetaTieneMateriales } from "@/features/inventory/domain/recetas";
import { COLECCION_RECETAS } from "@/features/inventory/services/recetas";
import {
  aplicarMovimientoEnTransaccion,
  type UsuarioMovimiento,
} from "@/features/inventory/services/materiales";

export interface FaltanteProduccion {
  materialId: string;
  nombre: string;
  requerido: number;
  actual: number;
}

export class RecetaNoConfiguradaError extends Error {
  constructor(modelo: string) {
    super(`No existe una receta completa para ${modelo}.`);
    this.name = "RecetaNoConfiguradaError";
  }
}

export async function actualizarEstadoPedido(
  pedido: Pedido,
  nuevoEstado: EstadoPedido,
  usuario: UsuarioMovimiento,
): Promise<FaltanteProduccion[]> {
  const pedidoRef = doc(db, "pedidos", pedido.id);

  return runTransaction(db, async transaction => {
    const pedidoSnap = await transaction.get(pedidoRef);
    if (!pedidoSnap.exists()) throw new Error("El pedido ya no existe.");

    const estadoActual = pedidoSnap.data().estado as EstadoPedido;
    if (nuevoEstado !== "En Producción" || estadoActual === "En Producción") {
      transaction.update(pedidoRef, { estado: nuevoEstado });
      return [];
    }

    const recetaRef = doc(db, COLECCION_RECETAS, pedido.modelo);
    const recetaSnap = await transaction.get(recetaRef);
    if (!recetaSnap.exists()) throw new RecetaNoConfiguradaError(pedido.modelo);

    const receta = { id: recetaSnap.id, ...recetaSnap.data() } as ProductoReceta;
    // Sin materiales ligados no habría nada que descontar: se exige receta completa.
    if (!recetaTieneMateriales(receta)) throw new RecetaNoConfiguradaError(pedido.modelo);

    const requeridos = calcularMaterialesRequeridos(receta, pedido.cantidad);
    const materialRefs = [...requeridos.keys()].map(id => doc(db, "materiales", id));
    const materialSnaps = await Promise.all(materialRefs.map(ref => transaction.get(ref)));
    const faltantes: FaltanteProduccion[] = [];

    materialSnaps.forEach((snapshot, index) => {
      const materialId = materialRefs[index].id;
      const material = snapshot.exists()
        ? ({ id: snapshot.id, ...snapshot.data() } as Material)
        : null;
      const actual = Number(material?.stockActual ?? 0);
      const requerido = requeridos.get(materialId) ?? 0;
      if (actual < requerido) {
        faltantes.push({ materialId, nombre: material?.nombre ?? materialId, requerido, actual });
      }
    });

    if (faltantes.length) return faltantes;

    // Cada descuento queda registrado en el historial de movimientos.
    for (const snapshot of materialSnaps) {
      const cantidad = requeridos.get(snapshot.id) ?? 0;
      if (cantidad <= 0) continue;
      aplicarMovimientoEnTransaccion(
        transaction,
        snapshot,
        {
          materialId: snapshot.id,
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
