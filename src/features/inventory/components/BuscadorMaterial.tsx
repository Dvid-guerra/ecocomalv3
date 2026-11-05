"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Camera, ScanLine } from "lucide-react";
import type { Material } from "@/types";
import { esFamilia, FAMILIAS, resolverEscaneo } from "../domain/materiales";
import { normalizar } from "../domain/texto";
import EscanerCamara, { camaraDisponible } from "./registro/EscanerCamara";

const sinSuscripcion = () => () => {};

interface Props {
  materiales: Material[];
  onElegir: (material: Material) => void;
  /** Texto a la derecha de cada fila. Por defecto el stock; en la auditoría se oculta (conteo ciego). */
  detalle?: (material: Material) => ReactNode;
  placeholder?: string;
  maxResultados?: number;
  /** Filtra solo la lista visible; el escáner siempre busca en todo el catálogo. */
  mostrar?: (material: Material) => boolean;
}

/**
 * Escaneo + búsqueda de materiales. Acepta lo que manda el lector (escribe y da Enter),
 * la cámara o lo que se escriba: QR de etiqueta, código de barras, ubicación o nombre.
 */
export default function BuscadorMaterial({
  materiales,
  onElegir,
  detalle,
  placeholder = "Escanear QR / código de barras o buscar",
  maxResultados = 30,
  mostrar,
}: Props) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [camara, setCamara] = useState(false);
  const conCamara = useSyncExternalStore(sinSuscripcion, camaraDisponible, () => false);

  const ordenados = useMemo(
    () => [...materiales].sort((a, b) => (a.ubicacion ?? "~").localeCompare(b.ubicacion ?? "~") || a.nombre.localeCompare(b.nombre, "es")),
    [materiales],
  );

  // Mientras se escribe se filtra por nombre/ubicación; el Enter resuelve códigos.
  const filtrados = useMemo(() => {
    const r = resolverEscaneo(ordenados, texto, normalizar);
    const lista = r.tipo === "uno" ? [r.material] : r.tipo === "varios" ? r.materiales : [];
    return mostrar && !texto.trim() ? lista.filter(mostrar) : lista;
  }, [ordenados, texto, mostrar]);

  const procesar = useCallback((entrada: string) => {
    const r = resolverEscaneo(ordenados, entrada, normalizar);
    if (r.tipo === "uno") {
      setTexto("");
      setAviso(null);
      onElegir(r.material);
    } else {
      setTexto(r.busqueda);
      setAviso(r.tipo === "ninguno" ? r.mensaje : null);
    }
  }, [ordenados, onElegir]);

  const onCodigoCamara = useCallback((valor: string) => {
    setCamara(false);
    procesar(valor);
  }, [procesar]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <label className="relative flex-1">
          <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
          <input
            autoFocus
            value={texto}
            onChange={e => {
              setTexto(e.target.value);
              setAviso(null);
            }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                procesar(texto);
              }
            }}
            placeholder={placeholder}
            className="w-full h-16 pl-14 pr-4 rounded-2xl border-slate-200 text-lg focus:ring-emerald-500 focus:border-emerald-500"
          />
        </label>
        {conCamara && (
          <button onClick={() => setCamara(true)} className="h-16 px-5 rounded-2xl bg-slate-900 text-white flex items-center gap-2 font-bold">
            <Camera className="w-6 h-6" /> <span className="hidden sm:inline">Cámara</span>
          </button>
        )}
      </div>

      {aviso && <p className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 px-5 py-3">{aviso}</p>}

      <ul className="space-y-2">
        {filtrados.slice(0, maxResultados).map(m => {
          const familia = esFamilia(m.familia) ? FAMILIAS[m.familia] : null;
          const stock = Number(m.stockActual ?? 0);
          return (
            <li key={m.id}>
              <button
                onClick={() => onElegir(m)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white ring-1 ring-slate-200 text-left active:bg-slate-100"
              >
                <span className="w-2.5 h-10 rounded-full shrink-0" style={{ backgroundColor: familia?.color ?? "#cbd5e1" }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-bold text-slate-900 truncate">{m.nombre}</span>
                  <span className="block text-xs font-mono text-slate-500">{m.ubicacion ?? "Sin ubicación"}</span>
                </span>
                {detalle ? detalle(m) : (
                  <span className={`font-mono text-lg font-bold ${stock <= Number(m.puntoReorden ?? 0) ? "text-red-600" : "text-slate-700"}`}>{stock}</span>
                )}
              </button>
            </li>
          );
        })}
        {filtrados.length === 0 && !aviso && <li className="text-slate-400 px-2">Sin resultados.</li>}
      </ul>

      {camara && <EscanerCamara onCodigo={onCodigoCamara} onClose={() => setCamara(false)} />}
    </div>
  );
}
