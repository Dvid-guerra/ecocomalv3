"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "./Badge";

export interface KpiCardProps {
  titulo: string;
  /** Valor principal. Se renderiza con cifras de ancho fijo. */
  valor: string | number;
  descripcion?: string;
  /** Cambio porcentual respecto al período anterior. */
  cambio?: number;
  icono?: ElementType;
  id: string;
  className?: string;
}

function CambioCapsula({ cambio }: { cambio: number }) {
  const esNeutro = cambio === 0;
  const esPositivo = cambio > 0;
  const Icono = esNeutro ? Minus : esPositivo ? TrendingUp : TrendingDown;

  return (
    <Badge
      tono={esNeutro ? "neutral" : esPositivo ? "ok" : "risk"}
      icono={<Icono className="w-3 h-3" strokeWidth={2} />}
      numerico
    >
      {esPositivo ? "+" : ""}
      {cambio.toFixed(1)}%
    </Badge>
  );
}

/**
 * Métrica de encabezado. El ícono es neutro a propósito: en una fila de
 * tres KPIs, un ícono de color por tarjeta compite con el dato, que es
 * lo único que el supervisor viene a leer.
 */
export function KpiCard({
  titulo,
  valor,
  descripcion,
  cambio,
  icono: Icono,
  id,
  className = "",
}: KpiCardProps) {
  return (
    <article
      id={id}
      className={cn(
        "surface-card rounded-card ring-1 ring-line shadow-card p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          {titulo}
        </p>
        {Icono && (
          <span
            className="w-8 h-8 shrink-0 rounded-control bg-sunken ring-1 ring-line text-ink-muted flex items-center justify-center"
            aria-hidden="true"
          >
            <Icono className="w-4 h-4" strokeWidth={1.5} />
          </span>
        )}
      </div>

      <p className="nums text-3xl font-bold text-ink leading-none">{valor}</p>

      <div className="flex items-center justify-between gap-2 mt-2">
        {descripcion && (
          <p className="text-xs text-ink-muted truncate">{descripcion}</p>
        )}
        {cambio !== undefined && <CambioCapsula cambio={cambio} />}
      </div>
    </article>
  );
}
