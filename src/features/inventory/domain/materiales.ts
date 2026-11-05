/**
 * Lógica pura de materiales: familias, ubicaciones y lectura de QR / código de barras.
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

export type CodigoEscaneado =
  | { tipo: "material"; id: string }
  | { tipo: "ubicacion"; codigo: string }
  | { tipo: "texto"; texto: string };

/**
 * Interpreta lo que llega del lector QR (o de la cámara, o escrito a mano):
 * - URL de etiqueta: `https://…/dashboard/inventario/registro?m=<id>`
 * - `M:<id>`
 * - Código de ubicación: `C-E1-N2-P03`
 * - Cualquier otra cosa (incluido un código de barras del proveedor) queda como texto.
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

/** Normaliza un código de barras: sin espacios ni guiones, en mayúsculas. */
export function normalizarCodigoBarras(texto: string) {
  return texto.replace(/[\s-]+/g, "").toUpperCase();
}

interface MaterialEscaneable {
  id: string;
  nombre: string;
  ubicacion?: string;
  codigoBarras?: string;
}

export type ResultadoEscaneo<M> =
  | { tipo: "uno"; material: M }
  | { tipo: "varios"; materiales: M[]; busqueda: string }
  | { tipo: "ninguno"; mensaje: string; busqueda: string };

/**
 * Resuelve lo escaneado o escrito contra el catálogo, en este orden:
 * QR de etiqueta → código de barras del proveedor → ubicación → nombre.
 */
export function resolverEscaneo<M extends MaterialEscaneable>(
  materiales: readonly M[],
  entrada: string,
  normalizarTexto: (t: string) => string,
): ResultadoEscaneo<M> {
  const codigo = leerCodigoEscaneado(entrada);

  if (codigo.tipo === "material") {
    const m = materiales.find(x => x.id === codigo.id);
    return m ? { tipo: "uno", material: m } : { tipo: "ninguno", mensaje: "Ese QR no corresponde a ningún material del catálogo.", busqueda: "" };
  }

  if (codigo.tipo === "texto") {
    const barras = normalizarCodigoBarras(codigo.texto);
    const porBarras = barras ? materiales.filter(x => x.codigoBarras && normalizarCodigoBarras(x.codigoBarras) === barras) : [];
    if (porBarras.length === 1) return { tipo: "uno", material: porBarras[0] };
    if (porBarras.length > 1) return { tipo: "varios", materiales: porBarras, busqueda: codigo.texto };
  }

  if (codigo.tipo === "ubicacion") {
    const enUbicacion = materiales.filter(x => x.ubicacion === codigo.codigo);
    if (enUbicacion.length === 1) return { tipo: "uno", material: enUbicacion[0] };
    if (enUbicacion.length > 1) return { tipo: "varios", materiales: enUbicacion, busqueda: codigo.codigo };
    return { tipo: "ninguno", mensaje: `No hay material asignado a ${codigo.codigo}.`, busqueda: codigo.codigo };
  }

  const q = normalizarTexto(codigo.texto);
  if (!q) return { tipo: "varios", materiales: [...materiales], busqueda: "" };
  const palabras = q.split(/\s+/);
  const porNombre = materiales.filter(x => {
    const n = normalizarTexto(`${x.nombre} ${x.ubicacion ?? ""}`);
    return palabras.every(p => n.includes(p));
  });
  if (porNombre.length === 1) return { tipo: "uno", material: porNombre[0] };
  if (porNombre.length === 0 && /^\d{6,14}$/.test(normalizarCodigoBarras(codigo.texto))) {
    return { tipo: "ninguno", mensaje: "Código de barras sin asignar. Agrégalo en la ficha del material.", busqueda: codigo.texto };
  }
  return porNombre.length
    ? { tipo: "varios", materiales: porNombre, busqueda: codigo.texto }
    : { tipo: "ninguno", mensaje: "Sin resultados.", busqueda: codigo.texto };
}
