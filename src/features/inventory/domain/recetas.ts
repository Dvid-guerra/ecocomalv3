/**
 * Cálculos puros sobre recetas (BOM) de estufas.
 * Fuente única: colección `recetas`, un documento por modelo con piezas → insumos.
 */
import type { ProductoReceta } from "@/types";

type Receta = Pick<ProductoReceta, "piezas">;

function redondear(valor: number) {
  return Math.round(valor * 1000) / 1000;
}

/** Cantidad total de cada material para fabricar `unidades` estufas. */
export function calcularMaterialesRequeridos(receta: Receta, unidades = 1): Map<string, number> {
  const totales = new Map<string, number>();
  for (const pieza of receta.piezas ?? []) {
    const piezasNecesarias = (pieza.cantidadPieza || 1) * unidades;
    for (const insumo of pieza.insumos ?? []) {
      if (!insumo.materialId || !(insumo.cantidadReq > 0)) continue;
      const actual = totales.get(insumo.materialId) ?? 0;
      totales.set(insumo.materialId, redondear(actual + insumo.cantidadReq * piezasNecesarias));
    }
  }
  return totales;
}

/** Una receta es utilizable si al menos un insumo está ligado a un material. */
export function recetaTieneMateriales(receta: Receta | null | undefined): boolean {
  return !!receta && calcularMaterialesRequeridos(receta).size > 0;
}

/** Costo de materiales por estufa. Materiales sin precio cuentan como 0. */
export function calcularCostoUnitario(receta: Receta, precios: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const [materialId, cantidad] of calcularMaterialesRequeridos(receta)) {
    total += cantidad * (precios.get(materialId) ?? 0);
  }
  return Math.round(total * 100) / 100;
}

export interface Faltante {
  materialId: string;
  requerido: number;
  disponible: number;
  falta: number;
}

/** Materiales que no alcanzan para fabricar `unidades` estufas. */
export function calcularFaltantes(
  receta: Receta,
  unidades: number,
  stock: ReadonlyMap<string, number>,
): Faltante[] {
  const faltantes: Faltante[] = [];
  for (const [materialId, requerido] of calcularMaterialesRequeridos(receta, unidades)) {
    const disponible = stock.get(materialId) ?? 0;
    if (disponible < requerido) {
      faltantes.push({ materialId, requerido, disponible, falta: redondear(requerido - disponible) });
    }
  }
  return faltantes;
}

export interface Capacidad {
  /** Estufas completas que se pueden fabricar con el stock actual. */
  unidades: number;
  /** Material que limita la producción (null si la receta no tiene materiales). */
  limitanteId: string | null;
}

/** Cuántas estufas se pueden fabricar con el stock actual y qué material lo limita. */
export function calcularCapacidad(receta: Receta, stock: ReadonlyMap<string, number>): Capacidad {
  let unidades = Infinity;
  let limitanteId: string | null = null;
  for (const [materialId, porUnidad] of calcularMaterialesRequeridos(receta)) {
    // Se suma un epsilon para que 0.3 / 0.1 no dé 2.9999 por punto flotante.
    const posibles = Math.floor((stock.get(materialId) ?? 0) / porUnidad + 1e-9);
    if (posibles < unidades) {
      unidades = posibles;
      limitanteId = materialId;
    }
  }
  return { unidades: Number.isFinite(unidades) ? unidades : 0, limitanteId };
}
