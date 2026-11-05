"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { db } from "@/lib/firebase";
import type { Material } from "@/types";
import { esFamilia, FAMILIAS, LISTA_FAMILIAS, urlEtiqueta } from "../domain/materiales";

/** Hoja de etiquetas 70 × 40 mm para las gavetas. El QR abre el Punto de registro con el material. */
export default function EtiquetasQR() {
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  const [familia, setFamilia] = useState("");
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => onSnapshot(collection(db, "materiales"), snap => {
    setMateriales(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Material)
        .sort((a, b) => (a.ubicacion ?? "~").localeCompare(b.ubicacion ?? "~") || a.nombre.localeCompare(b.nombre, "es")),
    );
  }), []);

  // Por defecto se marcan los que ya tienen ubicación (los que van en una gaveta).
  const marcados = useMemo(
    () => seleccion ?? new Set(materiales.filter(m => m.ubicacion).map(m => m.id)),
    [seleccion, materiales],
  );
  const visibles = materiales.filter(m => !familia || m.familia === familia);
  const aImprimir = useMemo(() => materiales.filter(m => marcados.has(m.id)), [materiales, marcados]);

  useEffect(() => {
    let vigente = true;
    const origen = window.location.origin;
    Promise.all(
      aImprimir.map(async m => [m.id, await QRCode.toString(urlEtiqueta(origen, m.id), { type: "svg", margin: 0, errorCorrectionLevel: "M" })] as const),
    ).then(pares => {
      if (vigente) setQrs(Object.fromEntries(pares));
    });
    return () => {
      vigente = false;
    };
  }, [aImprimir]);

  const alternar = (id: string) => {
    const nuevo = new Set(marcados);
    if (nuevo.has(id)) nuevo.delete(id);
    else nuevo.add(id);
    setSeleccion(nuevo);
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: letter; margin: 10mm; }
          body * { visibility: hidden !important; }
          .hoja-etiquetas, .hoja-etiquetas * { visibility: visible !important; }
          .hoja-etiquetas { position: absolute; left: 0; top: 0; }
        }
      `}</style>

      <header className="print:hidden flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventario" className="p-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 text-slate-600" aria-label="Volver a Inventario">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Etiquetas QR</h1>
            <p className="text-sm text-slate-500">70 × 40 mm · {aImprimir.length} seleccionadas</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          disabled={aImprimir.length === 0}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-40"
        >
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </header>

      <div className="print:hidden bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={familia} onChange={e => setFamilia(e.target.value)} className="rounded-xl border-slate-200 text-sm">
            <option value="">Todas las familias</option>
            {LISTA_FAMILIAS.map(f => <option key={f} value={f}>{FAMILIAS[f].etiqueta}</option>)}
          </select>
          <button onClick={() => setSeleccion(new Set([...marcados, ...visibles.map(m => m.id)]))} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">Marcar visibles</button>
          <button onClick={() => setSeleccion(new Set([...marcados].filter(id => !visibles.some(m => m.id === id))))} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">Desmarcar visibles</button>
          <p className="text-xs text-slate-400">La ubicación, familia y peso se editan en Catálogo Base → lápiz.</p>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
          {visibles.map(m => (
            <li key={m.id}>
              <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-sm">
                <input type="checkbox" checked={marcados.has(m.id)} onChange={() => alternar(m.id)} className="rounded" />
                <span className="flex-1 truncate">{m.nombre}</span>
                <span className="font-mono text-xs text-slate-400">{m.ubicacion ?? "—"}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="hoja-etiquetas flex flex-wrap gap-[3mm] bg-white print:bg-transparent p-4 print:p-0 rounded-3xl ring-1 ring-slate-200 print:ring-0">
        {aImprimir.map(m => {
          const fam = esFamilia(m.familia) ? FAMILIAS[m.familia] : null;
          return (
            <div
              key={m.id}
              className="flex overflow-hidden rounded-[2mm] border border-slate-400 bg-white text-black break-inside-avoid"
              style={{ width: "70mm", height: "40mm" }}
            >
              <div style={{ width: "4mm", backgroundColor: fam?.color ?? "#cbd5e1", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />
              <div className="flex-1 min-w-0 flex flex-col justify-between p-[2.5mm]">
                <p className="font-mono font-bold leading-none" style={{ fontSize: "5mm" }}>{m.ubicacion ?? "SIN UBICACIÓN"}</p>
                <p className="font-bold leading-tight line-clamp-2" style={{ fontSize: "3.6mm" }}>{m.nombre}</p>
                <p className="leading-tight text-slate-700" style={{ fontSize: "2.6mm" }}>
                  {fam?.etiqueta ?? "Sin familia"}
                  <br />
                  Mín. {m.puntoReorden ?? 0} {m.unidadMedida}
                  {m.pesoUnitarioG ? ` · ${m.pesoUnitarioG} g/pza` : ""}
                </p>
              </div>
              <div
                className="shrink-0 self-center p-[2mm] [&>svg]:w-full [&>svg]:h-full"
                style={{ width: "30mm", height: "30mm" }}
                dangerouslySetInnerHTML={{ __html: qrs[m.id] ?? "" }}
              />
            </div>
          );
        })}
        {aImprimir.length === 0 && <p className="text-slate-400 text-sm">Selecciona materiales para generar sus etiquetas.</p>}
      </div>
    </div>
  );
}
