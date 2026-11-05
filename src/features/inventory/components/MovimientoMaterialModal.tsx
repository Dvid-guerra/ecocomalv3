"use client";

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, ClipboardCheck, X } from "lucide-react";
import type { Material } from "@/types";
import {
  calcularMovimiento,
  ETIQUETAS_MOTIVO,
  MOTIVOS_POR_TIPO,
  type MotivoMovimiento,
  type TipoMovimiento,
} from "../domain/movimientos";
import { registrarMovimientoMaterial } from "../services/materiales";

const TIPOS: { value: TipoMovimiento; label: string; icon: typeof ArrowUpCircle; activo: string }[] = [
  { value: "entrada", label: "Entrada", icon: ArrowDownCircle, activo: "bg-emerald-600 text-white" },
  { value: "salida", label: "Salida", icon: ArrowUpCircle, activo: "bg-red-600 text-white" },
  { value: "ajuste", label: "Ajuste", icon: ClipboardCheck, activo: "bg-amber-500 text-white" },
];

interface Props {
  material: Material;
  tipoInicial?: TipoMovimiento;
  onClose: () => void;
}

export default function MovimientoMaterialModal({ material, tipoInicial = "entrada", onClose }: Props) {
  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial);
  const [motivo, setMotivo] = useState<MotivoMovimiento>(MOTIVOS_POR_TIPO[tipoInicial][0]);
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockActual = Number(material.stockActual ?? 0);

  const preview = useMemo(() => {
    if (cantidad === "") return null;
    try {
      return { ok: true as const, ...calcularMovimiento(stockActual, { materialId: material.id, tipo, motivo, cantidad: Number(cantidad) }) };
    } catch (e) {
      return { ok: false as const, mensaje: e instanceof Error ? e.message : "Movimiento inválido" };
    }
  }, [cantidad, tipo, motivo, stockActual, material.id]);

  const cambiarTipo = (nuevo: TipoMovimiento) => {
    setTipo(nuevo);
    setMotivo(MOTIVOS_POR_TIPO[nuevo][0]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview?.ok) return;
    setGuardando(true);
    setError(null);
    try {
      await registrarMovimientoMaterial({ materialId: material.id, tipo, motivo, cantidad: Number(cantidad), nota });
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl ring-1 ring-slate-200 p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{material.nombre}</h3>
            <p className="text-sm text-slate-500">
              Stock actual: <span className="font-mono font-bold text-slate-700">{stockActual}</span> {material.unidadMedida}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
          {TIPOS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => cambiarTipo(t.value)}
              className={`flex items-center justify-center gap-1.5 py-2 text-sm font-bold rounded-lg transition-colors ${tipo === t.value ? t.activo : "text-slate-500 hover:text-slate-700"}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {tipo === "ajuste" ? "Stock contado" : "Cantidad"}
            </span>
            <input
              type="number"
              step="any"
              min="0"
              autoFocus
              required
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              className="w-full rounded-xl border-slate-200 text-sm font-mono focus:ring-indigo-500 focus:border-indigo-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Motivo</span>
            <select
              value={motivo}
              onChange={e => setMotivo(e.target.value as MotivoMovimiento)}
              className="w-full rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {MOTIVOS_POR_TIPO[tipo].map(m => <option key={m} value={m}>{ETIQUETAS_MOTIVO[m]}</option>)}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase">Nota (opcional)</span>
          <input
            type="text"
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Ej. Para estufa del pedido de Don Carlos"
            className="w-full rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </label>

        {preview && (
          <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${preview.ok ? "bg-slate-50 ring-slate-200 text-slate-600" : "bg-red-50 ring-red-200 text-red-700"}`}>
            {preview.ok ? (
              <>
                Quedará en <span className="font-mono font-bold text-slate-800">{preview.stockResultante}</span>{" "}
                <span className={preview.delta >= 0 ? "text-emerald-600" : "text-red-600"}>
                  ({preview.delta >= 0 ? "+" : ""}{preview.delta})
                </span>
              </>
            ) : preview.mensaje}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!preview?.ok || guardando}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
