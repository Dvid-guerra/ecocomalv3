"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { AlertTriangle, ArrowRight, Box, ChevronDown, Layers } from "lucide-react";
import { db } from "@/lib/firebase";
import { MODELOS, type Material, type ProductoReceta, type RecetaInsumo } from "@/types";
import { suscribirRecetas } from "../services/recetas";
import {
  calcularCapacidad,
  calcularCostoUnitario,
  calcularMaterialesRequeridos,
} from "../domain/recetas";

interface RecetaAntigua {
  id: string;
  nombre: string;
  descripcion?: string;
  insumos: RecetaInsumo[];
}

const formatQ = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Vista de solo lectura de las recetas (BOM) para Planta.
 * Las recetas se editan únicamente en Inventario → Recetas (BOM).
 */
export default function ResumenRecetas() {
  const [recetas, setRecetas] = useState<ProductoReceta[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [antiguas, setAntiguas] = useState<RecetaAntigua[]>([]);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [verAntiguas, setVerAntiguas] = useState(false);

  useEffect(() => {
    const onError = (e: Error) => { console.error(e); setSinPermiso(true); };
    const unsubRec = suscribirRecetas(setRecetas, onError);
    const unsubMat = onSnapshot(
      collection(db, "materiales"),
      snap => setMateriales(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Material)),
      onError,
    );
    // Colección anterior de Planta: se muestra solo para no perder lo que se haya capturado.
    const unsubOld = onSnapshot(
      collection(db, "productos_recetas"),
      snap => setAntiguas(snap.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre ?? "",
        descripcion: d.data().descripcion ?? "",
        insumos: d.data().insumos ?? [],
      }))),
      () => setAntiguas([]),
    );
    return () => { unsubRec(); unsubMat(); unsubOld(); };
  }, []);

  const porId = useMemo(() => new Map(materiales.map(m => [m.id, m])), [materiales]);
  const stock = useMemo(() => new Map(materiales.map(m => [m.id, Number(m.stockActual) || 0])), [materiales]);
  const precios = useMemo(() => new Map(materiales.map(m => [m.id, Number(m.precioEstimado) || 0])), [materiales]);

  if (sinPermiso) {
    return (
      <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-300 text-sm text-slate-500">
        No tienes permisos para ver las recetas de materiales.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Recetas por Modelo (BOM)</h2>
          <p className="text-sm text-slate-500">Materiales por estufa y cuántas se pueden fabricar con el stock actual.</p>
        </div>
        <Link
          href="/dashboard/inventario"
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
        >
          Editar en Inventario <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MODELOS.map(modelo => {
          const receta = recetas.find(r => r.modelo === modelo);
          const requeridos = receta ? calcularMaterialesRequeridos(receta) : new Map<string, number>();
          const capacidad = receta ? calcularCapacidad(receta, stock) : null;
          const limitante = capacidad?.limitanteId ? porId.get(capacidad.limitanteId) : undefined;

          return (
            <div key={modelo} className="bg-white ring-1 ring-slate-200/80 rounded-3xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{modelo}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {receta?.piezas?.length ?? 0} piezas · {requeridos.size} materiales
                    </p>
                  </div>
                </div>
                {receta && requeridos.size > 0 && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900 font-mono">{capacidad?.unidades ?? 0}</p>
                    <p className="text-[11px] text-slate-500">se pueden fabricar</p>
                  </div>
                )}
              </div>

              {requeridos.size === 0 ? (
                <p className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4" /> Sin materiales ligados. Los pedidos de este modelo no podrán pasar a producción.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-slate-100 text-sm">
                    {[...requeridos].map(([materialId, cantidad]) => {
                      const mat = porId.get(materialId);
                      const esLimitante = materialId === capacidad?.limitanteId;
                      return (
                        <li key={materialId} className="flex items-center justify-between py-1.5">
                          <span className={esLimitante ? "font-semibold text-red-700" : "text-slate-700"}>
                            {mat?.nombre ?? "Material eliminado"}
                          </span>
                          <span className="font-mono text-slate-600">
                            {cantidad} <span className="text-xs text-slate-400 font-sans">{mat?.unidadMedida}</span>
                            <span className="text-xs text-slate-400 font-sans"> / hay {stock.get(materialId) ?? 0}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span>Costo de materiales: <span className="font-mono font-bold text-slate-700">{formatQ(calcularCostoUnitario(receta!, precios))}</span></span>
                    {limitante && <span>Limita: <span className="font-semibold text-red-700">{limitante.nombre}</span></span>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {antiguas.length > 0 && (
        <div className="bg-slate-50 ring-1 ring-slate-200 rounded-3xl p-5">
          <button
            onClick={() => setVerAntiguas(v => !v)}
            className="w-full flex items-center justify-between text-sm font-bold text-slate-700"
          >
            <span className="flex items-center gap-2">
              <Box className="w-4 h-4" /> Recetas antiguas de Planta ({antiguas.length}) — solo lectura
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${verAntiguas ? "rotate-180" : ""}`} />
          </button>
          {verAntiguas && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-500">
                Estas recetas usaban texto libre y no estaban ligadas al inventario. Pásalas a Inventario → Recetas (BOM)
                eligiendo los materiales del catálogo.
              </p>
              {antiguas.map(p => (
                <div key={p.id} className="bg-white rounded-2xl ring-1 ring-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-800">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-slate-500">{p.descripcion}</p>}
                  <ul className="mt-2 text-xs text-slate-600 space-y-0.5">
                    {p.insumos.map((ins, i) => (
                      <li key={i}>• {ins.nombre}: <span className="font-mono">{ins.cantidadReq}</span> {ins.unidad}</li>
                    ))}
                    {p.insumos.length === 0 && <li className="text-slate-400">Sin insumos</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
