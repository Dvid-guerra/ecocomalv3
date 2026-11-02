import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentSnapshot,
  type Timestamp,
  type Transaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  calcularMovimiento,
  type MotivoMovimiento,
  type MovimientoInput,
  type OrigenMovimiento,
  type ResultadoMovimiento,
  type TipoMovimiento,
} from "../domain/movimientos";

export const COLECCION_MOVIMIENTOS = "materiales_movimientos";

export interface UsuarioMovimiento {
  uid: string;
  nombre: string;
}

/** Documento en `materiales_movimientos`. Inmutable: nunca se edita ni se borra. */
export interface MovimientoMaterial {
  id: string;
  materialId: string;
  materialNombre: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number;
  delta: number;
  stockAnterior: number;
  stockResultante: number;
  nota?: string;
  referencia?: MovimientoInput["referencia"];
  origen: OrigenMovimiento;
  usuarioId: string;
  usuarioNombre: string;
  timestamp: Timestamp | null;
}

interface ContextoMovimiento {
  usuario: UsuarioMovimiento;
  origen: OrigenMovimiento;
}

/**
 * Aplica un movimiento dentro de una transacción ya abierta.
 * El snapshot del material debe haberse leído antes con `transaction.get`
 * (Firestore exige todas las lecturas antes de cualquier escritura).
 */
export function aplicarMovimientoEnTransaccion(
  transaction: Transaction,
  materialSnap: DocumentSnapshot,
  input: MovimientoInput,
  { usuario, origen }: ContextoMovimiento,
): ResultadoMovimiento {
  if (!materialSnap.exists()) throw new Error(`El material ${input.materialId} no existe.`);

  const data = materialSnap.data();
  const resultado = calcularMovimiento(Number(data.stockActual ?? 0), input);

  transaction.update(materialSnap.ref, {
    stockActual: resultado.stockResultante,
    actualizadoEn: serverTimestamp(),
  });

  const nota = input.nota?.trim();
  transaction.set(doc(collection(db, COLECCION_MOVIMIENTOS)), {
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
    timestamp: serverTimestamp(),
  });

  return resultado;
}

/** Registra un movimiento suelto (entrada, salida o ajuste) de forma atómica. */
export async function registrarMovimientoMaterial(
  input: MovimientoInput,
  usuario: UsuarioMovimiento,
  origen: OrigenMovimiento = "ui",
): Promise<ResultadoMovimiento> {
  const materialRef = doc(db, "materiales", input.materialId);
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(materialRef);
    return aplicarMovimientoEnTransaccion(transaction, snap, input, { usuario, origen });
  });
}

/** Escucha los movimientos más recientes de todos los materiales. */
export function suscribirMovimientosRecientes(
  onData: (movimientos: MovimientoMaterial[]) => void,
  onError?: (error: Error) => void,
  max = 100,
) {
  const q = query(collection(db, COLECCION_MOVIMIENTOS), orderBy("timestamp", "desc"), limit(max));
  return onSnapshot(
    q,
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MovimientoMaterial)),
    onError,
  );
}
