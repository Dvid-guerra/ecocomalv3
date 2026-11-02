import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface RegistrarMovimientoInput {
  modelo: string;
  cantidad: number;
  tipo: "entrada" | "salida";
  observaciones: string;
  fecha: string;
  hora: string;
}

export class StockInsuficienteError extends Error {
  constructor(public readonly disponible: number) {
    super(`Stock insuficiente. Disponible: ${disponible} unidades.`);
    this.name = "StockInsuficienteError";
  }
}

export async function registrarMovimientoStock(input: RegistrarMovimientoInput) {
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a cero.");
  }

  const stockRef = doc(db, "inventario_stock", input.modelo);
  const movimientoRef = doc(collection(db, "inventario_movimientos"));

  await runTransaction(db, async transaction => {
    const stockSnap = await transaction.get(stockRef);
    const disponible = Number(stockSnap.data()?.cantidad ?? 0);
    const siguiente = input.tipo === "entrada"
      ? disponible + input.cantidad
      : disponible - input.cantidad;

    if (siguiente < 0) throw new StockInsuficienteError(disponible);

    transaction.set(stockRef, { cantidad: siguiente }, { merge: true });
    transaction.set(movimientoRef, { ...input, timestamp: serverTimestamp() });
  });
}
