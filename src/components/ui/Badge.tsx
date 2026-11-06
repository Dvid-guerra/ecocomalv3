"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tonos semánticos, no colores. Un badge nombra un estado —
 * "Bajo stock", "Entregado", "Prioridad alta" — y el tono dice
 * qué tan urgente es, igual en los siete módulos.
 */
export type Tono = "neutral" | "ok" | "warn" | "risk" | "info" | "solido";

const TONO_CLASES: Record<Tono, string> = {
  neutral: "bg-sunken text-ink-body ring-line",
  ok: "bg-ok-surface text-ok ring-ok-line",
  warn: "bg-warn-surface text-warn ring-warn-line",
  risk: "bg-risk-surface text-risk ring-risk-line",
  info: "bg-info-surface text-info ring-info-line",
  solido: "bg-action text-white ring-transparent",
};

interface BadgeProps {
  children: ReactNode;
  tono?: Tono;
  icono?: ReactNode;
  /** Activa cifras de ancho fijo. Para contadores y cantidades. */
  numerico?: boolean;
  className?: string;
}

export function Badge({
  children,
  tono = "neutral",
  icono,
  numerico = false,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-control",
        "text-xs font-semibold ring-1 whitespace-nowrap",
        TONO_CLASES[tono],
        numerico && "nums",
        className,
      )}
    >
      {icono && <span className="shrink-0" aria-hidden="true">{icono}</span>}
      {children}
    </span>
  );
}
