"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { ETIQUETAS_MOTIVO, type TipoMovimiento } from "../domain/movimientos";
import { suscribirMovimientosRecientes, type MovimientoMaterial } from "../services/materiales";

const ESTILO_TIPO: Record<TipoMovimiento, string> = {
  entrada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  salida: "bg-red-50 text-red-700 ring-red-200",
  ajuste: "bg-amber-50 text-amber-700 ring-amber-200",
};

const ORIGEN: Record<MovimientoMaterial["origen"], string> = {
  ui: "Manual",
  kiosko: "Punto de registro",
  pedido: "Pedido",
  agente: "Asistente IA",
  sensor: "Sensor",
};

function formatFecha(m: MovimientoMaterial) {
  if (!m.timestamp) return "Guardando…";
  return m.timestamp.toDate().toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" });
}

export default function HistorialMovimientos() {
  const [movimientos, setMovimientos] = useState<MovimientoMaterial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    return suscribirMovimientosRecientes(
      data => { setMovimientos(data); setCargando(false); },
      err => { console.error(err); setError("No se pudo cargar el historial."); setCargando(false); },
    );
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return movimientos;
    return movimientos.filter(m =>
      m.materialNombre.toLowerCase().includes(q) || m.usuarioNombre.toLowerCase().includes(q),
    );
  }, [movimientos, busqueda]);

  return (
    <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" /> Historial de Movimientos
        </h2>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar material o usuario…"
            className="pl-9 w-64 rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto ring-1 ring-slate-200 rounded-xl">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">Fecha</th>
              <th className="px-4 py-3 font-bold">Material</th>
              <th className="px-4 py-3 font-bold">Tipo</th>
              <th className="px-4 py-3 font-bold text-right">Cambio</th>
              <th className="px-4 py-3 font-bold text-right">Stock</th>
              <th className="px-4 py-3 font-bold">Motivo</th>
              <th className="px-4 py-3 font-bold">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map(m => (
              <tr key={m.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatFecha(m)}</td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {m.materialNombre}
                  {m.nota && <p className="text-xs font-normal text-slate-400 mt-0.5">{m.nota}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md ring-1 capitalize ${ESTILO_TIPO[m.tipo]}`}>{m.tipo}</span>
                </td>
                <td className={`px-4 py-3 text-right font-mono font-bold ${m.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {m.delta >= 0 ? "+" : ""}{m.delta}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                  {m.stockAnterior} → <span className="font-bold text-slate-700">{m.stockResultante}</span>
                </td>
                <td className="px-4 py-3">{ETIQUETAS_MOTIVO[m.motivo] ?? m.motivo}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {m.usuarioNombre}
                  <p className="text-xs text-slate-400">
                    {ORIGEN[m.origen] ?? m.origen}
                    {m.registradoPorNombre && ` · registró ${m.registradoPorNombre}`}
                  </p>
                </td>
              </tr>
            ))}
            {!cargando && filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {error ?? (busqueda ? "Sin resultados para esa búsqueda." : "Todavía no hay movimientos registrados.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">Se muestran los últimos 100 movimientos. El historial no se puede editar ni borrar.</p>
    </div>
  );
}
