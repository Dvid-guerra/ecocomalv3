"use client";

import type { ElementType, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────
   Spinner
───────────────────────────────────────────── */

interface SpinnerProps {
  /** Texto para lectores de pantalla y, si `visible`, también en pantalla. */
  etiqueta: string;
  visible?: boolean;
  tamano?: "sm" | "md" | "lg";
  className?: string;
}

const SPINNER_TAMANO = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-7 h-7",
} as const;

export function Spinner({ etiqueta, visible = false, tamano = "md", className = "" }: SpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)} role="status">
      <Loader2
        className={cn("animate-spin text-ink-muted", SPINNER_TAMANO[tamano])}
        strokeWidth={2}
        aria-hidden="true"
      />
      {visible ? (
        <p className="text-sm font-medium text-ink-muted">{etiqueta}</p>
      ) : (
        <span className="sr-only">{etiqueta}</span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   EmptyState
───────────────────────────────────────────── */

interface EmptyStateProps {
  icono: ElementType;
  titulo: string;
  /** Qué hacer para que deje de estar vacío. Un vacío sin salida es un callejón. */
  descripcion?: string;
  accion?: ReactNode;
  className?: string;
}

export function EmptyState({
  icono: Icono,
  titulo,
  descripcion,
  accion,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12 gap-1",
        className,
      )}
    >
      <span
        className="w-11 h-11 mb-2 rounded-card bg-sunken ring-1 ring-line flex items-center justify-center text-ink-muted"
        aria-hidden="true"
      >
        <Icono className="w-5 h-5" strokeWidth={1.5} />
      </span>
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      {descripcion && (
        <p className="text-xs text-ink-muted max-w-[42ch] leading-relaxed">{descripcion}</p>
      )}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Skeleton
───────────────────────────────────────────── */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn("animate-skeleton bg-line rounded-card", className)}
      aria-hidden="true"
    />
  );
}

/* ─────────────────────────────────────────────
   Aviso en línea (error / éxito de formulario)
───────────────────────────────────────────── */

interface AvisoProps {
  tono: "ok" | "warn" | "risk";
  icono?: ElementType;
  children: ReactNode;
  className?: string;
}

const AVISO_CLASES = {
  ok: "bg-ok-surface text-ok ring-ok-line",
  warn: "bg-warn-surface text-warn ring-warn-line",
  risk: "bg-risk-surface text-risk ring-risk-line",
} as const;

export function Aviso({ tono, icono: Icono, children, className = "" }: AvisoProps) {
  return (
    <div
      role={tono === "risk" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 px-3 py-2.5 rounded-control ring-1 text-xs font-medium",
        AVISO_CLASES[tono],
        className,
      )}
    >
      {Icono && <Icono className="w-4 h-4 shrink-0 mt-px" strokeWidth={2} aria-hidden="true" />}
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
