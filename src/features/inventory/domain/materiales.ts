/**
 * Lógica pura de materiales: familias, ubicaciones, conteo por peso y lectura de QR.
 * Sin dependencias de Firebase para poder probarla con `node --test`.
 */

/** Familias de consumibles. El color coincide con el de las gavetas del furgón. */
export const FAMILIAS = {
  tornilleria: { etiqueta: "Tornillería y fijación", color: "#2563eb" },
  soldadura: { etiqueta: "Soldadura", color: "#dc2626" },
  abrasivos: { etiqueta: "Abrasivos", color: "#16a34a" },
  electrico: { etiqueta: "Eléctrico", color: "#ca8a04" },
  epp: { etiqueta: "EPP y varios", color: "#6b7280" },
  pintura: { etiqueta: "Pintura y químicos", color: "#7c3aed" },
  materia_prima: { etiqueta: "Materia prima", color: "#0f766e" },
} as const;

export type FamiliaMaterial = keyof typeof FAMILIAS;
export const LISTA_FAMILIAS = Object.keys(FAMILIAS) as FamiliaMaterial[];

export function esFamilia(valor: unknown): valor is FamiliaMaterial {
  return typeof valor === "string" && valor in FAMILIAS;
}

/**
 * Código de ubicación: `ZONA-E<sección>-N<nivel>-P<posición>`, ej. `C-E1-N2-P03`.
 * Se acepta escrito a mano ("c e1 n2 p3") y se normaliza.
 */
const RE_UBICACION = /^([A-Z]{1,3})-?E(\d{1,2})-?N(\d{1,2})-?P(\d{1,3})$/;

export function normalizarUbicacion(texto: string): string | null {
  const limpio = texto.toUpperCase().replace(/[\s_.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!limpio) return null;
  const m = RE_UBICACION.exec(limpio.replace(/-/g, ""));
  if (!m) return null;
  const [, zona, seccion, nivel, posicion] = m;
  return `${zona}-E${Number(seccion)}-N${Number(nivel)}-P${String(Number(posicion)).padStart(2, "0")}`;
}

/**
 * Piezas a partir de la diferencia de peso (gaveta antes y después de sacar).
 * Devuelve también qué tan "redondo" salió para avisar si la báscula o el peso unitario no cuadran.
 */
export function piezasPorPeso(pesoAntesG: number, pesoDespuesG: number, pesoUnitarioG: number) {
  if (![pesoAntesG, pesoDespuesG, pesoUnitarioG].every(Number.isFinite) || pesoUnitarioG <= 0) {
    return null;
  }
  const diferencia = Math.abs(pesoAntesG - pesoDespuesG);
  const exacto = diferencia / pesoUnitarioG;
  const piezas = Math.round(exacto);
  return {
    piezas,
    diferenciaG: Math.round(diferencia * 10) / 10,
    /** 0 = cuadra perfecto, 0.5 = justo entre dos cantidades. */
    desviacion: Math.round(Math.abs(exacto - piezas) * 100) / 100,
    salieron: pesoDespuesG < pesoAntesG,
  };
}

/** Peso unitario promedio a partir de pesar varias piezas juntas. */
export function pesoUnitarioDesdeMuestra(pesoTotalG: number, piezas: number) {
  if (!Number.isFinite(pesoTotalG) || !Number.isInteger(piezas) || pesoTotalG <= 0 || piezas <= 0) return null;
  return Math.round((pesoTotalG / piezas) * 100) / 100;
}

export type CodigoEscaneado =
  | { tipo: "material"; id: string }
  | { tipo: "ubicacion"; codigo: string }
  | { tipo: "texto"; texto: string };

/**
 * Interpreta lo que llega del lector QR (o de la cámara, o escrito a mano):
 * - URL de etiqueta: `https://…/dashboard/inventario/registro?m=<id>`
 * - `M:<id>`
 * - Código de ubicación: `C-E1-N2-P03`
 * - Cualquier otra cosa se usa como búsqueda por nombre.
 */
export function leerCodigoEscaneado(entrada: string): CodigoEscaneado {
  const texto = entrada.trim();
  if (!texto) return { tipo: "texto", texto: "" };

  if (/^https?:\/\//i.test(texto)) {
    try {
      const id = new URL(texto).searchParams.get("m");
      if (id) return { tipo: "material", id };
    } catch {
      // URL mal formada: se trata como texto.
    }
  }

  const prefijo = /^M:(.+)$/i.exec(texto);
  if (prefijo) return { tipo: "material", id: prefijo[1].trim() };

  const ubicacion = normalizarUbicacion(texto);
  if (ubicacion) return { tipo: "ubicacion", codigo: ubicacion };

  return { tipo: "texto", texto };
}

/** URL que va dentro del QR de la etiqueta: abre el Punto de registro con el material. */
export function urlEtiqueta(origen: string, materialId: string) {
  return `${origen.replace(/\/$/, "")}/dashboard/inventario/registro?m=${encodeURIComponent(materialId)}`;
}
