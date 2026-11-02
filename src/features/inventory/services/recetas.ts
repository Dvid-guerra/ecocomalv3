import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ProductoReceta, RecetaPieza } from "@/types";

/** Fuente única de recetas (BOM). El id del documento es el nombre del modelo. */
export const COLECCION_RECETAS = "recetas";

export function suscribirRecetas(
  onData: (recetas: ProductoReceta[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, COLECCION_RECETAS),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ProductoReceta)),
    onError,
  );
}

export async function guardarReceta(modelo: string, piezas: RecetaPieza[]) {
  // Se limpian insumos sin material o con cantidad inválida antes de guardar.
  const limpias = piezas.map(p => ({
    nombrePieza: p.nombrePieza,
    cantidadPieza: p.cantidadPieza || 1,
    insumos: (p.insumos ?? [])
      .filter(i => i.materialId && i.cantidadReq > 0)
      .map(i => ({ materialId: i.materialId, cantidadReq: i.cantidadReq })),
  }));
  await setDoc(doc(db, COLECCION_RECETAS, modelo), { id: modelo, modelo, piezas: limpias });
}
