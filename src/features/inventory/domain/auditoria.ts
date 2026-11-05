/**
 * Lógica pura de la auditoría mensual de inventario (conteo físico de todo el catálogo).
 * Sin dependencias de Firebase para poder probarla con `node --test`.
 */

export interface ConteoAuditoria {
  contado: number;
  /** Stock del sistema en el momento del conteo (no se muestra al contar: conteo ciego). */
  sistemaAlContar: number;
  contadoPorId: string;
  contadoPorNombre: string;
}

export interface MaterialAuditado {
  id: string;
  nombre: string;
  unidad: string;
  precio: number;
  /** Stock del sistema al cerrar la auditoría. */
  stockActual: number;
}

export interface LineaAuditoria {
  materialId: string;
  nombre: string;
  unidad: string;
  sistema: number;
  contado: number;
  /** contado − sistema al contar. Negativo = faltante. */
  diferencia: number;
  valorDiferencia: number;
  /** Stock que debe quedar al cerrar: lo contado + lo que se movió después del conteo. */
  stockFinal: number;
}

export interface ResumenAuditoria {
  lineas: LineaAuditoria[];
  noContados: { materialId: string; nombre: string }[];
  totales: {
    contados: number;
    conDiferencia: number;
    valorFaltante: number;
    valorSobrante: number;
    valorNeto: number;
  };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Mes de la auditoría en formato `2026-11`, en hora de Guatemala. */
export function mesAuditoria(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit" })
    .formatToParts(fecha);
  const anio = partes.find(p => p.type === "year")?.value;
  const mes = partes.find(p => p.type === "month")?.value;
  return `${anio}-${mes}`;
}

export function nombreMes(mes: string) {
  const [anio, m] = mes.split("-").map(Number);
  const texto = new Date(Date.UTC(anio, m - 1, 15)).toLocaleDateString("es-GT", { month: "long", year: "numeric", timeZone: "UTC" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function validarConteo(contado: number) {
  if (!Number.isFinite(contado) || contado < 0) throw new Error("El conteo debe ser un número mayor o igual a cero.");
  return r3(contado);
}

/**
 * Compara lo contado con el sistema.
 * Si hubo movimientos después de contar un material (alguien sacó algo durante la auditoría),
 * se respetan: el stock final es lo contado más ese cambio posterior.
 */
export function resumirAuditoria(
  materiales: readonly MaterialAuditado[],
  conteos: Readonly<Record<string, ConteoAuditoria>>,
): ResumenAuditoria {
  const lineas: LineaAuditoria[] = [];
  const noContados: ResumenAuditoria["noContados"] = [];

  for (const m of materiales) {
    const c = conteos[m.id];
    if (!c) {
      noContados.push({ materialId: m.id, nombre: m.nombre });
      continue;
    }
    const diferencia = r3(c.contado - c.sistemaAlContar);
    const movidoDespues = r3(m.stockActual - c.sistemaAlContar);
    lineas.push({
      materialId: m.id,
      nombre: m.nombre,
      unidad: m.unidad,
      sistema: c.sistemaAlContar,
      contado: c.contado,
      diferencia,
      valorDiferencia: r2(diferencia * m.precio),
      stockFinal: Math.max(0, r3(c.contado + movidoDespues)),
    });
  }

  lineas.sort((a, b) => a.valorDiferencia - b.valorDiferencia || a.nombre.localeCompare(b.nombre, "es"));
  const valorFaltante = r2(lineas.reduce((acc, l) => acc + Math.min(0, l.valorDiferencia), 0));
  const valorSobrante = r2(lineas.reduce((acc, l) => acc + Math.max(0, l.valorDiferencia), 0));

  return {
    lineas,
    noContados,
    totales: {
      contados: lineas.length,
      conDiferencia: lineas.filter(l => l.diferencia !== 0).length,
      valorFaltante,
      valorSobrante,
      valorNeto: r2(valorFaltante + valorSobrante),
    },
  };
}
