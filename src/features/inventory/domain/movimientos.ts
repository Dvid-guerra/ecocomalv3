/**
 * Lógica pura de movimientos de materiales.
 * Sin dependencias de Firebase para poder probarla con `node --test`.
 */

export const TIPOS_MOVIMIENTO = ["entrada", "salida", "ajuste"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const MOTIVOS_POR_TIPO = {
  entrada: ["compra", "devolucion", "otro"],
  salida: ["consumo_produccion", "trabajo_externo", "merma", "otro"],
  ajuste: ["conteo_fisico"],
} as const satisfies Record<TipoMovimiento, readonly string[]>;

export type MotivoMovimiento = (typeof MOTIVOS_POR_TIPO)[TipoMovimiento][number];

export const ETIQUETAS_MOTIVO: Record<MotivoMovimiento, string> = {
  compra: "Compra",
  devolucion: "Devolución",
  consumo_produccion: "Consumo de producción",
  trabajo_externo: "Trabajo externo",
  merma: "Merma / desperdicio",
  conteo_fisico: "Conteo físico",
  otro: "Otro",
};

/** Quién o qué originó el movimiento. `kiosko` = Punto de registro del furgón. */
export const ORIGENES_MOVIMIENTO = ["ui", "kiosko", "pedido", "agente", "sensor"] as const;
export type OrigenMovimiento = (typeof ORIGENES_MOVIMIENTO)[number];

export interface MovimientoInput {
  materialId: string;
  tipo: TipoMovimiento;
  /**
   * entrada/salida: cantidad que entra o sale (> 0).
   * ajuste: stock real contado (>= 0); la diferencia se calcula sola.
   */
  cantidad: number;
  motivo: MotivoMovimiento;
  nota?: string;
  referencia?: { tipo: "pedido" | "orden_compra" | "auditoria"; id: string };
}

export interface ResultadoMovimiento {
  stockAnterior: number;
  stockResultante: number;
  /** Cambio real aplicado al stock (negativo en salidas). */
  delta: number;
}

/** Datos del movimiento inválidos (error del usuario, no del sistema). */
export class MovimientoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovimientoInvalidoError";
  }
}

export class StockMaterialInsuficienteError extends Error {
  readonly disponible: number;
  readonly solicitado: number;

  constructor(disponible: number, solicitado: number) {
    super(`Stock insuficiente: hay ${disponible} y se piden ${solicitado}.`);
    this.name = "StockMaterialInsuficienteError";
    this.disponible = disponible;
    this.solicitado = solicitado;
  }
}

/** Redondea a 3 decimales para evitar basura de punto flotante (ej. 0.1 + 0.2). */
function redondear(valor: number) {
  return Math.round(valor * 1000) / 1000;
}

export function validarMovimiento(input: MovimientoInput): void {
  if (!input.materialId) throw new MovimientoInvalidoError("Falta el material.");
  if (!TIPOS_MOVIMIENTO.includes(input.tipo)) throw new MovimientoInvalidoError(`Tipo inválido: ${input.tipo}`);

  const motivos: readonly string[] = MOTIVOS_POR_TIPO[input.tipo];
  if (!motivos.includes(input.motivo)) {
    throw new MovimientoInvalidoError(`El motivo "${input.motivo}" no aplica a un movimiento de ${input.tipo}.`);
  }

  if (!Number.isFinite(input.cantidad)) throw new MovimientoInvalidoError("La cantidad debe ser un número.");
  if (input.tipo === "ajuste" ? input.cantidad < 0 : input.cantidad <= 0) {
    throw new MovimientoInvalidoError(input.tipo === "ajuste"
      ? "El stock contado no puede ser negativo."
      : "La cantidad debe ser mayor a cero.");
  }
}

/** Calcula el stock resultante. Lanza si una salida deja el stock en negativo. */
export function calcularMovimiento(stockActual: number, input: MovimientoInput): ResultadoMovimiento {
  validarMovimiento(input);
  const anterior = redondear(Number.isFinite(stockActual) ? stockActual : 0);

  let resultante: number;
  if (input.tipo === "entrada") resultante = anterior + input.cantidad;
  else if (input.tipo === "salida") resultante = anterior - input.cantidad;
  else resultante = input.cantidad;

  resultante = redondear(resultante);
  if (resultante < 0) throw new StockMaterialInsuficienteError(anterior, input.cantidad);

  return { stockAnterior: anterior, stockResultante: resultante, delta: redondear(resultante - anterior) };
}
