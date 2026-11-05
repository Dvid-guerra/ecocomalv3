import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { postJson } from "@/lib/api-cliente";
import type {
  MotivoMovimiento,
  MovimientoInput,
  OrigenMovimiento,
  ResultadoMovimiento,
  TipoMovimiento,
} from "../domain/movimientos";

export const COLECCION_MOVIMIENTOS = "materiales_movimientos";

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
  /** Quien hizo físicamente el movimiento. */
  usuarioId: string;
  usuarioNombre: string;
  /** Cuenta que lo registró, si fue otra (ej. la tablet del Punto de registro). */
  registradoPorId?: string;
  registradoPorNombre?: string;
  timestamp: Timestamp | null;
}

interface OpcionesMovimiento {
  origen?: "ui" | "kiosko";
  /** Punto de registro: uid de la persona que sacó o metió el material. */
  realizadoPorId?: string;
}

/**
 * Registra un movimiento (entrada, salida o ajuste) en el servidor.
 * El stock nunca se escribe desde el cliente: lo hace /api/inventario/movimientos en una transacción.
 */
export async function registrarMovimientoMaterial(
  input: MovimientoInput,
  opciones: OpcionesMovimiento = {},
): Promise<ResultadoMovimiento> {
  const { resultado } = await postJson<{ resultado: ResultadoMovimiento }>("/api/inventario/movimientos", {
    ...input,
    ...opciones,
  });
  return resultado;
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
