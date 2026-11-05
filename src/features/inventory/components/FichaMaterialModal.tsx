"use client";

import { useState } from "react";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { Scale, X } from "lucide-react";
import { db } from "@/lib/firebase";
import type { Material, Proveedor } from "@/types";
import {
  FAMILIAS,
  LISTA_FAMILIAS,
  normalizarUbicacion,
  pesoUnitarioDesdeMuestra,
} from "../domain/materiales";

interface Props {
  material: Material;
  proveedores: Proveedor[];
  onClose: () => void;
}

const input = "w-full rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500";
const etiqueta = "text-xs font-bold text-slate-500 uppercase";

/** Edita los datos del material. El stock NO se edita aquí: se cambia con movimientos. */
export default function FichaMaterialModal({ material, proveedores, onClose }: Props) {
  const [form, setForm] = useState({
    nombre: material.nombre,
    unidadMedida: material.unidadMedida,
    precioEstimado: String(material.precioEstimado ?? ""),
    proveedorDefectoId: material.proveedorDefectoId ?? "",
    puntoReorden: String(material.puntoReorden ?? 0),
    familia: material.familia ?? "",
    ubicacion: material.ubicacion ?? "",
    pesoUnitarioG: material.pesoUnitarioG ? String(material.pesoUnitarioG) : "",
  });
  const [muestra, setMuestra] = useState({ piezas: "20", pesoG: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (campo: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [campo]: e.target.value }));

  const pesoMuestra = pesoUnitarioDesdeMuestra(Number(muestra.pesoG), Number(muestra.piezas));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ubicacion = form.ubicacion.trim() ? normalizarUbicacion(form.ubicacion) : null;
    if (form.ubicacion.trim() && !ubicacion) {
      setError("Ubicación inválida. Formato: C-E1-N2-P03 (zona, estante, nivel, posición).");
      return;
    }
    const peso = form.pesoUnitarioG ? Number(form.pesoUnitarioG) : null;
    if (peso !== null && !(peso > 0)) {
      setError("El peso por pieza debe ser mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      await updateDoc(doc(db, "materiales", material.id), {
        nombre: form.nombre.trim(),
        unidadMedida: form.unidadMedida.trim() || "Unidad",
        precioEstimado: Number(form.precioEstimado) || 0,
        proveedorDefectoId: form.proveedorDefectoId,
        puntoReorden: Math.max(0, Number(form.puntoReorden) || 0),
        familia: form.familia || deleteField(),
        ubicacion: ubicacion ?? deleteField(),
        pesoUnitarioG: peso ?? deleteField(),
      });
      onClose();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar. Revisa la conexión.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-xl ring-1 ring-slate-200 p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Ficha del material</h3>
            <p className="text-sm text-slate-500">
              Stock: <span className="font-mono font-bold">{material.stockActual ?? 0}</span> {material.unidadMedida} · se cambia con movimientos
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block space-y-1">
          <span className={etiqueta}>Nombre</span>
          <input required value={form.nombre} onChange={set("nombre")} className={input} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={etiqueta}>Unidad</span>
            <input value={form.unidadMedida} onChange={set("unidadMedida")} className={input} />
          </label>
          <label className="space-y-1">
            <span className={etiqueta}>Precio est. (Q)</span>
            <input type="number" step="0.01" min="0" value={form.precioEstimado} onChange={set("precioEstimado")} className={`${input} font-mono`} />
          </label>
          <label className="space-y-1">
            <span className={etiqueta}>Proveedor</span>
            <select value={form.proveedorDefectoId} onChange={set("proveedorDefectoId")} className={input}>
              <option value="">Sin asignar</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className={etiqueta}>Punto de reorden</span>
            <input type="number" min="0" step="any" value={form.puntoReorden} onChange={set("puntoReorden")} className={`${input} font-mono`} />
          </label>
        </div>

        <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-100 p-4 space-y-3">
          <p className="text-sm font-bold text-slate-700">Furgón y etiqueta</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={etiqueta}>Familia</span>
              <select value={form.familia} onChange={set("familia")} className={input}>
                <option value="">Sin familia</option>
                {LISTA_FAMILIAS.map(f => <option key={f} value={f}>{FAMILIAS[f].etiqueta}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className={etiqueta}>Ubicación</span>
              <input
                value={form.ubicacion}
                onChange={set("ubicacion")}
                onBlur={() => setForm(f => ({ ...f, ubicacion: normalizarUbicacion(f.ubicacion) ?? f.ubicacion }))}
                placeholder="C-E1-N2-P03"
                className={`${input} font-mono uppercase`}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className={etiqueta}>Peso por pieza (g)</span>
            <input type="number" step="0.01" min="0" value={form.pesoUnitarioG} onChange={set("pesoUnitarioG")} placeholder="Para contar por peso" className={`${input} font-mono`} />
          </label>

          <div className="flex flex-wrap items-end gap-2 text-sm">
            <Scale className="w-4 h-4 text-slate-400 mb-2.5" />
            <label className="space-y-1">
              <span className={etiqueta}>Pesé</span>
              <input type="number" min="1" step="1" value={muestra.piezas} onChange={e => setMuestra(m => ({ ...m, piezas: e.target.value }))} className={`${input} w-20 font-mono`} />
            </label>
            <span className="mb-2.5 text-slate-500">piezas =</span>
            <label className="space-y-1">
              <span className={etiqueta}>Gramos</span>
              <input type="number" min="0" step="0.1" value={muestra.pesoG} onChange={e => setMuestra(m => ({ ...m, pesoG: e.target.value }))} className={`${input} w-24 font-mono`} />
            </label>
            <button
              type="button"
              disabled={!pesoMuestra}
              onClick={() => pesoMuestra && setForm(f => ({ ...f, pesoUnitarioG: String(pesoMuestra) }))}
              className="mb-0.5 px-3 py-2 rounded-xl text-xs font-bold bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              {pesoMuestra ? `Usar ${pesoMuestra} g` : "Calcular"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button type="submit" disabled={guardando} className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
