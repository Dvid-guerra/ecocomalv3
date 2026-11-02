"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ReactNode } from "react";

/* ─────────────────────────────────────────────
   Tipos
───────────────────────────────────────────── */
export interface KpiCardProps {
  /** Etiqueta superior en uppercase pequeño */
  titulo: string;
  /** Valor principal a destacar */
  valor: string;
  /** Descripción o unidad secundaria */
  descripcion?: string;
  /** Porcentaje de cambio respecto al período anterior (ej: +12.4) */
  cambio?: number;
  /** Ícono decorativo (lucide-react node) */
  icono?: ReactNode;
  /** ID único para accesibilidad y testing */
  id: string;
}

/* ─────────────────────────────────────────────
   Sub-componente: micro-cápsula de cambio porcentual
───────────────────────────────────────────── */
function CambioCapsula({ cambio }: { cambio: number }) {
  const esPositivo = cambio > 0;
  const esNeutro   = cambio === 0;

  const colorBase = esNeutro
    ? "bg-slate-100 text-slate-500 ring-slate-200/60"
    : esPositivo
      ? "bg-emerald-50 text-emerald-600 ring-emerald-200/60"
      : "bg-red-50    text-red-500    ring-red-200/60";

  const Icono = esNeutro ? Minus : esPositivo ? TrendingUp : TrendingDown;
  const signo = esPositivo ? "+" : "";

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5
        text-xs font-semibold rounded-full
        ring-1 shadow-inner
        ${colorBase}
      `}
    >
      <Icono className="w-3 h-3" strokeWidth={2} />
      {signo}{cambio.toFixed(1)}%
    </span>
  );
}

/* ─────────────────────────────────────────────
   Componente principal: KpiCard
───────────────────────────────────────────── */
export function KpiCard({
  titulo,
  valor,
  descripcion,
  cambio,
  icono,
  id,
}: KpiCardProps) {
  return (
    <article
      id={id}
      aria-label={`Métrica: ${titulo}`}
      className="
        group relative
        bg-gradient-to-b from-white to-slate-50/50
        rounded-2xl
        ring-1 ring-slate-200/60
        shadow-xs shadow-inner shadow-slate-100/40
        p-5
        transition-all duration-200
        hover:-translate-y-0.5 hover:ring-slate-300/80
        hover:shadow-sm hover:from-white hover:to-white
        active:scale-[0.99]
      "
    >
      {/* Encabezado: etiqueta + ícono */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          {titulo}
        </p>

        {icono && (
          <span className="
            inline-flex items-center justify-center
            w-8 h-8 rounded-xl
            bg-slate-100/80 ring-1 ring-slate-200/60
            text-slate-500
            group-hover:bg-slate-900 group-hover:text-white group-hover:ring-slate-800
            transition-all duration-200
          ">
            {icono}
          </span>
        )}
      </div>

      {/* Valor principal */}
      <p className="text-2xl font-bold text-slate-800 tracking-tight leading-none mb-1.5">
        {valor}
      </p>

      {/* Fila inferior: descripción + cápsula de cambio */}
      <div className="flex items-center justify-between gap-2 mt-2">
        {descripcion && (
          <p className="text-xs text-slate-400 truncate">{descripcion}</p>
        )}
        {cambio !== undefined && <CambioCapsula cambio={cambio} />}
      </div>
    </article>
  );
}
