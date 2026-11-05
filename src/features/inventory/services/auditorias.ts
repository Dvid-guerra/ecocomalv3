import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { postJson } from "@/lib/api-cliente";
import type { ConteoAuditoria, ResumenAuditoria } from "../domain/auditoria";

export interface Auditoria {
  id: string;
  mes: string;
  estado: "en_curso" | "cerrada" | "cancelada";
  totalMateriales: number;
  conteos: Record<string, ConteoAuditoria & { en?: Timestamp | null }>;
  iniciadaEn: Timestamp | null;
  iniciadaPorNombre: string;
  cerradaEn?: Timestamp | null;
  cerradaPorNombre?: string;
  resumen?: ResumenAuditoria;
  ajustesAplicados?: number;
}

/** Las auditorías más recientes (la en curso, si hay, siempre es la primera). */
export function suscribirAuditorias(onData: (a: Auditoria[]) => void, onError?: (e: Error) => void, max = 12) {
  return onSnapshot(
    query(collection(db, "auditorias_inventario"), orderBy("iniciadaEn", "desc"), limit(max)),
    snap => onData(snap.docs.map(d => ({ id: d.id, conteos: {}, ...d.data() }) as Auditoria)),
    onError,
  );
}

export const iniciarAuditoria = () => postJson<{ id: string; mes: string }>("/api/inventario/auditorias", {});

const accion = (id: string, body: object) => postJson<Record<string, unknown>>(`/api/inventario/auditorias/${encodeURIComponent(id)}`, body);

export const registrarConteo = (id: string, materialId: string, contado: number) =>
  accion(id, { accion: "contar", materialId, contado });
export const cerrarAuditoria = (id: string) => accion(id, { accion: "cerrar" });
export const cancelarAuditoria = (id: string) => accion(id, { accion: "cancelar" });

export function fechaCorta(t?: Timestamp | null) {
  return t ? t.toDate().toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Guatemala" }) : "—";
}

export const quetzales = (n: number) =>
  `${n < 0 ? "−" : ""}Q${Math.abs(n).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
