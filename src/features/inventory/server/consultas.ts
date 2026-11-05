import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { MODELOS, type Material, type ProductoReceta } from "@/types";
import {
  calcularCapacidad,
  calcularCostoUnitario,
  calcularFaltantes,
  calcularMaterialesRequeridos,
} from "../domain/recetas";
import type { TipoMovimiento } from "../domain/movimientos";
import { esFamilia, FAMILIAS } from "../domain/materiales";
import { normalizar } from "../domain/texto";

/**
 * Consultas de solo lectura para el servidor (agente IA, futuros endpoints).
 * Reutilizan el mismo dominio que la UI para que los números coincidan.
 */

function coincide(nombre: string, busqueda?: string) {
  if (!busqueda?.trim()) return true;
  const n = normalizar(nombre);
  return normalizar(busqueda).split(/\s+/).every(palabra => n.includes(palabra));
}

async function cargarMateriales() {
  const [mats, provs] = await Promise.all([
    adminDb.collection("materiales").get(),
    adminDb.collection("proveedores").get(),
  ]);
  const proveedores = new Map(provs.docs.map(d => [d.id, String(d.data().nombre ?? "")]));
  return mats.docs.map(d => {
    const m = { id: d.id, ...d.data() } as Material;
    return {
      id: m.id,
      nombre: m.nombre,
      unidad: m.unidadMedida,
      stock: Number(m.stockActual) || 0,
      puntoReorden: Number(m.puntoReorden) || 0,
      precio: Number(m.precioEstimado) || 0,
      proveedor: m.proveedorDefectoId ? proveedores.get(m.proveedorDefectoId) ?? null : null,
      ubicacion: m.ubicacion || null,
      familia: esFamilia(m.familia) ? FAMILIAS[m.familia].etiqueta : null,
    };
  });
}

type MaterialResumen = Awaited<ReturnType<typeof cargarMateriales>>[number];

async function cargarRecetas() {
  const snap = await adminDb.collection("recetas").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as ProductoReceta);
}

export async function consultarStock(busqueda?: string) {
  const materiales = (await cargarMateriales()).filter(
    m => coincide(m.nombre, busqueda) || (m.ubicacion !== null && coincide(m.ubicacion, busqueda)),
  );
  return {
    total: materiales.length,
    materiales: materiales.slice(0, 40).map(m => ({
      nombre: m.nombre,
      stock: m.stock,
      unidad: m.unidad,
      puntoReorden: m.puntoReorden,
      estado: m.stock <= m.puntoReorden ? "PEDIR" : "OK",
      ubicacion: m.ubicacion ?? "sin asignar",
      familia: m.familia,
    })),
  };
}

export async function materialesBajoMinimo() {
  const bajos = (await cargarMateriales())
    .filter(m => m.stock <= m.puntoReorden)
    .sort((a, b) => a.stock / (a.puntoReorden || 1) - b.stock / (b.puntoReorden || 1));
  return {
    total: bajos.length,
    materiales: bajos.map(m => ({
      nombre: m.nombre,
      stock: m.stock,
      puntoReorden: m.puntoReorden,
      unidad: m.unidad,
      proveedor: m.proveedor,
      precioEstimado: m.precio,
      ubicacion: m.ubicacion,
    })),
  };
}

function nombreDe(materiales: Map<string, MaterialResumen>, id: string | null) {
  return id ? materiales.get(id)?.nombre ?? "Material eliminado" : null;
}

export async function capacidadProduccion(modelo?: string) {
  const [lista, recetas] = await Promise.all([cargarMateriales(), cargarRecetas()]);
  const porId = new Map(lista.map(m => [m.id, m]));
  const stock = new Map(lista.map(m => [m.id, m.stock]));
  const precios = new Map(lista.map(m => [m.id, m.precio]));

  const modelos = modelo ? [modelo] : [...MODELOS];
  return modelos.map(nombre => {
    const receta = recetas.find(r => r.modelo === nombre);
    if (!receta || calcularMaterialesRequeridos(receta).size === 0) {
      return { modelo: nombre, recetaConfigurada: false as const };
    }
    const { unidades, limitanteId } = calcularCapacidad(receta, stock);
    return {
      modelo: nombre,
      recetaConfigurada: true as const,
      unidadesPosibles: unidades,
      materialLimitante: nombreDe(porId, limitanteId),
      costoMaterialesPorUnidad: calcularCostoUnitario(receta, precios),
    };
  });
}

export async function faltantesParaProducir(modelo: string, unidades: number) {
  const [lista, recetas] = await Promise.all([cargarMateriales(), cargarRecetas()]);
  const receta = recetas.find(r => r.modelo === modelo);
  if (!receta || calcularMaterialesRequeridos(receta).size === 0) {
    return { modelo, unidades, recetaConfigurada: false as const };
  }
  const porId = new Map(lista.map(m => [m.id, m]));
  const faltantes = calcularFaltantes(receta, unidades, new Map(lista.map(m => [m.id, m.stock])));
  const costoCompra = faltantes.reduce((acc, f) => acc + f.falta * (porId.get(f.materialId)?.precio ?? 0), 0);
  return {
    modelo,
    unidades,
    recetaConfigurada: true as const,
    alcanza: faltantes.length === 0,
    faltantes: faltantes.map(f => {
      const m = porId.get(f.materialId);
      return {
        material: m?.nombre ?? "Material eliminado",
        requerido: f.requerido,
        disponible: f.disponible,
        falta: f.falta,
        unidad: m?.unidad,
        proveedor: m?.proveedor ?? null,
      };
    }),
    costoEstimadoCompra: Math.round(costoCompra * 100) / 100,
  };
}

export async function historialMovimientos(opciones: {
  busqueda?: string;
  dias: number;
  tipo?: TipoMovimiento;
  limite: number;
}) {
  const desde = Timestamp.fromMillis(Date.now() - opciones.dias * 86_400_000);
  // Una sola condición de rango sobre timestamp: no requiere índice compuesto.
  const snap = await adminDb
    .collection("materiales_movimientos")
    .where("timestamp", ">=", desde)
    .orderBy("timestamp", "desc")
    .limit(500)
    .get();

  const movimientos = snap.docs
    .map(d => d.data())
    .filter(m => (!opciones.tipo || m.tipo === opciones.tipo) && coincide(String(m.materialNombre ?? ""), opciones.busqueda));

  const totalesPorMaterial: Record<string, number> = {};
  for (const m of movimientos) {
    const nombre = String(m.materialNombre);
    totalesPorMaterial[nombre] = Math.round(((totalesPorMaterial[nombre] ?? 0) + Number(m.delta)) * 1000) / 1000;
  }

  return {
    periodoDias: opciones.dias,
    totalMovimientos: movimientos.length,
    cambioNetoPorMaterial: totalesPorMaterial,
    movimientos: movimientos.slice(0, opciones.limite).map(m => ({
      fecha: (m.timestamp as Timestamp | undefined)?.toDate().toLocaleString("es-GT", { timeZone: "America/Guatemala" }),
      material: m.materialNombre,
      tipo: m.tipo,
      motivo: m.motivo,
      cambio: m.delta,
      stockResultante: m.stockResultante,
      usuario: m.usuarioNombre,
      origen: m.origen,
      nota: m.nota ?? null,
    })),
  };
}

export async function ultimasAuditorias() {
  const snap = await adminDb.collection("auditorias_inventario").orderBy("iniciadaEn", "desc").limit(4).get();
  return snap.docs.map(d => {
    const a = d.data();
    const totales = a.resumen?.totales;
    return {
      mes: a.mes,
      estado: a.estado,
      materialesEnCatalogo: a.totalMateriales,
      contados: a.estado === "en_curso" ? Object.keys(a.conteos ?? {}).length : totales?.contados ?? 0,
      conDiferencia: totales?.conDiferencia ?? null,
      valorFaltante: totales?.valorFaltante ?? null,
      valorSobrante: totales?.valorSobrante ?? null,
      // Las 10 diferencias de mayor valor.
      diferencias: (a.resumen?.lineas ?? [])
        .filter((l: { diferencia: number }) => l.diferencia !== 0)
        .slice(0, 10)
        .map((l: { nombre: string; diferencia: number; unidad: string; valorDiferencia: number }) => ({
          material: l.nombre, diferencia: l.diferencia, unidad: l.unidad, valor: l.valorDiferencia,
        })),
      cerradaPor: a.cerradaPorNombre ?? null,
    };
  });
}

export async function stockEstufas() {
  const snap = await adminDb.collection("inventario_stock").get();
  const porModelo = new Map(snap.docs.map(d => [d.id, Number(d.data().cantidad) || 0]));
  return MODELOS.map(modelo => ({ modelo, enBodega: porModelo.get(modelo) ?? 0 }));
}
