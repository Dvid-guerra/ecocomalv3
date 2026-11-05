"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, ClipboardCheck, Minus, Plus } from "lucide-react";
import type { Material, Pedido } from "@/types";
import {
  calcularMovimiento,
  ETIQUETAS_MOTIVO,
  MOTIVOS_POR_TIPO,
  type MotivoMovimiento,
  type ResultadoMovimiento,
  type TipoMovimiento,
} from "../../domain/movimientos";
import { esFamilia, FAMILIAS } from "../../domain/materiales";
import { registrarMovimientoMaterial } from "../../services/materiales";

export interface PersonaRegistro {
  uid: string;
  nombre: string;
}

export interface ResumenRegistro extends ResultadoMovimiento {
  tipo: TipoMovimiento;
  cantidad: number;
  material: Material;
  persona: PersonaRegistro;
}

const TIPOS: { value: TipoMovimiento; label: string; icon: typeof ArrowUpCircle; activo: string }[] = [
  { value: "salida", label: "Salida", icon: ArrowUpCircle, activo: "bg-red-600 text-white ring-red-600" },
  { value: "entrada", label: "Entrada", icon: ArrowDownCircle, activo: "bg-emerald-600 text-white ring-emerald-600" },
  { value: "ajuste", label: "Conteo", icon: ClipboardCheck, activo: "bg-amber-500 text-white ring-amber-500" },
];

interface Props {
  material: Material;
  persona: PersonaRegistro;
  pedidos: Pedido[];
  onRegistrado: (resumen: ResumenRegistro) => void;
  onCambiarMaterial: () => void;
}

export default function PasoCantidad({ material, persona, pedidos, onRegistrado, onCambiarMaterial }: Props) {
  const [tipo, setTipo] = useState<TipoMovimiento>("salida");
  const [motivo, setMotivo] = useState<MotivoMovimiento>(MOTIVOS_POR_TIPO.salida[0]);
  const [cantidad, setCantidad] = useState("");
  const [pedidoId, setPedidoId] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stock = Number(material.stockActual ?? 0);
  const minimo = Number(material.puntoReorden ?? 0);
  const familia = esFamilia(material.familia) ? FAMILIAS[material.familia] : null;
  const usaPedido = tipo === "salida" && motivo === "consumo_produccion" && pedidos.length > 0;

  const preview = useMemo(() => {
    if (cantidad === "") return null;
    try {
      return { ok: true as const, ...calcularMovimiento(stock, { materialId: material.id, tipo, motivo, cantidad: Number(cantidad) }) };
    } catch (e) {
      return { ok: false as const, mensaje: e instanceof Error ? e.message : "Cantidad inválida" };
    }
  }, [cantidad, stock, material.id, tipo, motivo]);

  const cambiarTipo = (nuevo: TipoMovimiento) => {
    setTipo(nuevo);
    setMotivo(MOTIVOS_POR_TIPO[nuevo][0]);
    setError(null);
  };

  const sumar = (n: number) => {
    const actual = Number(cantidad) || 0;
    setCantidad(String(Math.max(0, Math.round((actual + n) * 1000) / 1000)));
  };

  const confirmar = async () => {
    if (!preview?.ok) return;
    setGuardando(true);
    setError(null);
    const pedido = usaPedido ? pedidos.find(p => p.id === pedidoId) : undefined;
    const notaFinal = nota.trim() || (pedido ? `${pedido.cantidad} × ${pedido.modelo} — ${pedido.clienteNombre}` : "");
    try {
      const resultado = await registrarMovimientoMaterial(
        {
          materialId: material.id,
          tipo,
          motivo,
          cantidad: Number(cantidad),
          ...(notaFinal ? { nota: notaFinal } : {}),
          ...(pedido ? { referencia: { tipo: "pedido" as const, id: pedido.id } } : {}),
        },
        { origen: "kiosko", realizadoPorId: persona.uid },
      );
      navigator.vibrate?.(60);
      onRegistrado({ ...resultado, tipo, cantidad: Number(cantidad), material, persona });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Material */}
      <div className="flex items-start gap-4 bg-white rounded-3xl ring-1 ring-slate-200 p-5">
        <span className="w-3 self-stretch rounded-full shrink-0" style={{ backgroundColor: familia?.color ?? "#cbd5e1" }} />
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold text-slate-900 leading-tight">{material.nombre}</p>
          <p className="text-sm text-slate-500 mt-1">
            {material.ubicacion && <span className="font-mono font-bold text-slate-700">{material.ubicacion}</span>}
            {material.ubicacion && familia && " · "}
            {familia?.etiqueta}
          </p>
          <p className="mt-2 text-lg">
            Hay <span className={`font-mono font-bold ${stock <= minimo ? "text-red-600" : "text-slate-900"}`}>{stock}</span>{" "}
            <span className="text-slate-500">{material.unidadMedida}</span>
          </p>
        </div>
        <button onClick={onCambiarMaterial} className="px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">
          Cambiar
        </button>
      </div>

      {/* Tipo */}
      <div className="grid grid-cols-3 gap-3">
        {TIPOS.map(t => (
          <button
            key={t.value}
            onClick={() => cambiarTipo(t.value)}
            className={`flex flex-col items-center gap-1 py-4 rounded-2xl text-base font-bold ring-2 transition-colors ${tipo === t.value ? t.activo : "bg-white text-slate-600 ring-slate-200"}`}
          >
            <t.icon className="w-7 h-7" /> {t.label}
          </button>
        ))}
      </div>

      {/* Motivo */}
      {MOTIVOS_POR_TIPO[tipo].length > 1 && (
        <div className="flex flex-wrap gap-2">
          {MOTIVOS_POR_TIPO[tipo].map(m => (
            <button
              key={m}
              onClick={() => setMotivo(m)}
              className={`px-4 py-3 rounded-2xl text-sm font-bold ring-1 ${motivo === m ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"}`}
            >
              {ETIQUETAS_MOTIVO[m]}
            </button>
          ))}
        </div>
      )}

      {/* Cantidad */}
      <div className="bg-white rounded-3xl ring-1 ring-slate-200 p-5 space-y-4">
        <p className="text-sm font-bold text-slate-500 uppercase">
          {tipo === "ajuste" ? "Cantidad contada en la gaveta" : tipo === "salida" ? "Cantidad que sale" : "Cantidad que entra"}
        </p>
        <div className="flex items-center gap-3">
          <button onClick={() => sumar(-1)} className="w-16 h-16 shrink-0 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center active:bg-slate-200" aria-label="Menos uno">
            <Minus className="w-8 h-8" />
          </button>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            placeholder="0"
            className="flex-1 min-w-0 h-16 text-center text-4xl font-mono font-bold rounded-2xl border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button onClick={() => sumar(1)} className="w-16 h-16 shrink-0 rounded-2xl bg-slate-900 text-white flex items-center justify-center active:bg-slate-700" aria-label="Más uno">
            <Plus className="w-8 h-8" />
          </button>
        </div>
        <div className="flex gap-2">
          {[5, 10, 20].map(n => (
            <button key={n} onClick={() => sumar(n)} className="flex-1 py-2 rounded-xl text-sm font-bold bg-slate-50 ring-1 ring-slate-200 text-slate-600">
              +{n}
            </button>
          ))}
        </div>

      </div>

      {/* Pedido y nota */}
      {usaPedido && (
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase">Para el pedido (opcional)</span>
          <select value={pedidoId} onChange={e => setPedidoId(e.target.value)} className="w-full h-14 rounded-2xl border-slate-200 text-base">
            <option value="">Sin pedido</option>
            {pedidos.map(p => <option key={p.id} value={p.id}>{p.cantidad} × {p.modelo} — {p.clienteNombre}</option>)}
          </select>
        </label>
      )}
      <input
        type="text"
        value={nota}
        onChange={e => setNota(e.target.value)}
        placeholder="Nota (opcional)"
        maxLength={300}
        className="w-full h-14 rounded-2xl border-slate-200 text-base"
      />

      {/* Resultado */}
      {preview && (
        <div className={`rounded-2xl px-5 py-4 text-lg ring-1 ${preview.ok ? "bg-slate-50 ring-slate-200 text-slate-700" : "bg-red-50 ring-red-200 text-red-700"}`}>
          {preview.ok ? (
            <>
              Quedarán <span className="font-mono font-bold text-slate-900">{preview.stockResultante}</span> {material.unidadMedida}
              {preview.stockResultante <= minimo && (
                <span className="flex items-center gap-2 mt-1 text-base text-amber-700">
                  <AlertTriangle className="w-5 h-5" /> Queda en el mínimo o abajo: hay que comprar.
                </span>
              )}
            </>
          ) : preview.mensaje}
        </div>
      )}

      {error && <p className="rounded-2xl bg-red-600 text-white px-5 py-4 text-base font-bold">{error}</p>}

      <button
        onClick={confirmar}
        disabled={!preview?.ok || guardando || (tipo !== "ajuste" && Number(cantidad) <= 0)}
        className="w-full h-20 rounded-3xl text-2xl font-bold bg-emerald-600 text-white active:bg-emerald-700 disabled:opacity-40"
      >
        {guardando ? "Registrando…" : "Confirmar"}
      </button>
    </div>
  );
}
