import "server-only";
import { FieldPath, FieldValue, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  mesAuditoria,
  nombreMes,
  resumirAuditoria,
  validarConteo,
  type ConteoAuditoria,
} from "../domain/auditoria";
import { aplicarMovimientoEnTransaccion, type Persona } from "./movimientos";

export const COLECCION_AUDITORIAS = "auditorias_inventario";

/** Firestore admite 500 escrituras por transacción: 2 por ajuste + 1 de la auditoría. */
const MAX_AJUSTES = 240;

export class ErrorAuditoria extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "ErrorAuditoria";
    this.status = status;
  }
}

const auditorias = () => adminDb.collection(COLECCION_AUDITORIAS);

/** Abre la auditoría del mes. Solo puede haber una en curso. */
export async function iniciarAuditoria(usuario: Persona) {
  const ref = auditorias().doc();
  const mes = mesAuditoria();
  await adminDb.runTransaction(async tx => {
    const enCurso = await tx.get(auditorias().where("estado", "==", "en_curso").limit(1));
    if (!enCurso.empty) throw new ErrorAuditoria("Ya hay una auditoría en curso. Ciérrala o cancélala primero.");
    const materiales = await tx.get(adminDb.collection("materiales").select());
    tx.create(ref, {
      mes,
      estado: "en_curso",
      totalMateriales: materiales.size,
      conteos: {},
      iniciadaEn: FieldValue.serverTimestamp(),
      iniciadaPorId: usuario.uid,
      iniciadaPorNombre: usuario.nombre,
    });
  });
  return { id: ref.id, mes };
}

async function leerEnCurso(tx: Transaction, id: string) {
  const snap = await tx.get(auditorias().doc(id));
  if (!snap.exists) throw new ErrorAuditoria("La auditoría no existe.", 404);
  if (snap.data()?.estado !== "en_curso") throw new ErrorAuditoria("La auditoría ya está cerrada.");
  return snap;
}

/** Guarda (o corrige) el conteo de un material. Guarda también el stock del sistema en ese momento. */
export async function registrarConteo(id: string, materialId: string, contado: number, usuario: Persona) {
  let cantidad: number;
  try {
    cantidad = validarConteo(contado);
  } catch (e) {
    throw new ErrorAuditoria(e instanceof Error ? e.message : "Conteo inválido.", 400);
  }
  await adminDb.runTransaction(async tx => {
    const auditoria = await leerEnCurso(tx, id);
    const material = await tx.get(adminDb.collection("materiales").doc(materialId));
    if (!material.exists) throw new ErrorAuditoria("El material no existe.", 404);
    const conteo: ConteoAuditoria & { en: FieldValue } = {
      contado: cantidad,
      sistemaAlContar: Number(material.data()?.stockActual ?? 0),
      contadoPorId: usuario.uid,
      contadoPorNombre: usuario.nombre,
      en: FieldValue.serverTimestamp(),
    };
    tx.update(auditoria.ref, new FieldPath("conteos", materialId), conteo);
  });
}

/**
 * Cierra la auditoría: ajusta el stock de cada material contado (conteo físico, ligado a la
 * auditoría en el historial) y guarda el resumen de diferencias. Los no contados no se tocan.
 */
export async function cerrarAuditoria(id: string, usuario: Persona) {
  return adminDb.runTransaction(async tx => {
    const auditoria = await leerEnCurso(tx, id);
    const data = auditoria.data() ?? {};
    const conteos = (data.conteos ?? {}) as Record<string, ConteoAuditoria>;
    if (Object.keys(conteos).length === 0) throw new ErrorAuditoria("No hay ningún material contado.", 400);

    const materialesSnap = await tx.get(adminDb.collection("materiales"));
    const snaps = new Map<string, DocumentSnapshot>(materialesSnap.docs.map(d => [d.id, d]));
    const resumen = resumirAuditoria(
      materialesSnap.docs.map(d => ({
        id: d.id,
        nombre: String(d.data().nombre ?? d.id),
        unidad: String(d.data().unidadMedida ?? ""),
        precio: Number(d.data().precioEstimado) || 0,
        stockActual: Number(d.data().stockActual ?? 0),
      })),
      conteos,
    );

    const ajustes = resumen.lineas.filter(l => l.stockFinal !== Number(snaps.get(l.materialId)?.data()?.stockActual ?? 0));
    if (ajustes.length > MAX_AJUSTES) {
      throw new ErrorAuditoria(`Son ${ajustes.length} ajustes; el máximo por cierre es ${MAX_AJUSTES}.`, 400);
    }

    const nota = `Auditoría ${nombreMes(String(data.mes))}`;
    for (const linea of ajustes) {
      aplicarMovimientoEnTransaccion(
        tx,
        snaps.get(linea.materialId)!,
        {
          materialId: linea.materialId,
          tipo: "ajuste",
          cantidad: linea.stockFinal,
          motivo: "conteo_fisico",
          nota,
          referencia: { tipo: "auditoria", id },
        },
        { usuario, origen: "ui" },
      );
    }

    tx.update(auditoria.ref, {
      estado: "cerrada",
      cerradaEn: FieldValue.serverTimestamp(),
      cerradaPorId: usuario.uid,
      cerradaPorNombre: usuario.nombre,
      resumen,
      ajustesAplicados: ajustes.length,
    });
    return resumen.totales;
  });
}

export async function cancelarAuditoria(id: string, usuario: Persona) {
  await adminDb.runTransaction(async tx => {
    const auditoria = await leerEnCurso(tx, id);
    tx.update(auditoria.ref, {
      estado: "cancelada",
      cerradaEn: FieldValue.serverTimestamp(),
      cerradaPorId: usuario.uid,
      cerradaPorNombre: usuario.nombre,
    });
  });
}
