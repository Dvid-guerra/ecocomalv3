import "server-only";
import { FieldValue, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import {
  calcularMovimiento,
  MOTIVOS_POR_TIPO,
  type MovimientoInput,
  type OrigenMovimiento,
  type ResultadoMovimiento,
} from "../domain/movimientos";

/**
 * Única vía de escritura de stock de materiales.
 * La UI, el Punto de registro, los pedidos, el asistente y (luego) las básculas pasan por aquí.
 * Las reglas de Firestore bloquean `stockActual` y `materiales_movimientos` desde el cliente.
 */

export const COLECCION_MOVIMIENTOS = "materiales_movimientos";

export interface Persona {
  uid: string;
  nombre: string;
}

export interface ContextoMovimiento {
  /** Quién hizo físicamente el movimiento (quien sacó o metió el material). */
  usuario: Persona;
  /** Cuenta con sesión que lo registró, si es distinta (ej. la tablet del furgón). */
  registradoPor?: Persona;
  origen: OrigenMovimiento;
}

const motivos = Object.values(MOTIVOS_POR_TIPO).flat() as [string, ...string[]];

/** Esquema de entrada para las APIs. La validación de negocio la hace el dominio. */
export const esquemaMovimiento = z.object({
  materialId: z.string().min(1).max(128),
  tipo: z.enum(["entrada", "salida", "ajuste"]),
  cantidad: z.number().finite(),
  motivo: z.enum(motivos),
  nota: z.string().max(300).optional(),
  referencia: z
    .object({ tipo: z.enum(["pedido", "orden_compra"]), id: z.string().min(1).max(128) })
    .optional(),
});

/**
 * Aplica un movimiento dentro de una transacción ya abierta.
 * El snapshot del material debe leerse antes con `transaction.get`
 * (Firestore exige todas las lecturas antes de cualquier escritura).
 */
export function aplicarMovimientoEnTransaccion(
  transaction: Transaction,
  materialSnap: DocumentSnapshot,
  input: MovimientoInput,
  { usuario, registradoPor, origen }: ContextoMovimiento,
): ResultadoMovimiento {
  if (!materialSnap.exists) throw new MaterialNoEncontradoError(input.materialId);

  const data = materialSnap.data() ?? {};
  const resultado = calcularMovimiento(Number(data.stockActual ?? 0), input);

  transaction.update(materialSnap.ref, {
    stockActual: resultado.stockResultante,
    actualizadoEn: FieldValue.serverTimestamp(),
  });

  const nota = input.nota?.trim();
  const otraCuenta = registradoPor && registradoPor.uid !== usuario.uid;
  transaction.create(adminDb.collection(COLECCION_MOVIMIENTOS).doc(), {
    materialId: input.materialId,
    materialNombre: String(data.nombre ?? input.materialId),
    tipo: input.tipo,
    motivo: input.motivo,
    cantidad: input.cantidad,
    ...resultado,
    ...(nota ? { nota } : {}),
    ...(input.referencia ? { referencia: input.referencia } : {}),
    origen,
    usuarioId: usuario.uid,
    usuarioNombre: usuario.nombre,
    ...(otraCuenta ? { registradoPorId: registradoPor.uid, registradoPorNombre: registradoPor.nombre } : {}),
    timestamp: FieldValue.serverTimestamp(),
  });

  return resultado;
}

export class MaterialNoEncontradoError extends Error {
  constructor(materialId: string) {
    super(`El material ${materialId} no existe.`);
    this.name = "MaterialNoEncontradoError";
  }
}

/** Registra un movimiento suelto (entrada, salida o ajuste) de forma atómica. */
export async function registrarMovimiento(input: MovimientoInput, contexto: ContextoMovimiento) {
  const materialRef = adminDb.collection("materiales").doc(input.materialId);
  const resultado = await adminDb.runTransaction(async transaction => {
    const snap = await transaction.get(materialRef);
    return aplicarMovimientoEnTransaccion(transaction, snap, input, contexto);
  });
  return resultado;
}

/** Busca a una persona activa por uid (para el Punto de registro, donde la tablet registra por otro). */
export async function personaActiva(uid: string): Promise<Persona | null> {
  const snap = await adminDb.collection("usuarios").doc(uid).get();
  const data = snap.data();
  if (!snap.exists || data?.activo !== true) return null;
  return { uid, nombre: String(data.nombre ?? "") };
}
