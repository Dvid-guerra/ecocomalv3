"use client";

import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  /** Ícono del módulo, en la cápsula neutra del sistema. */
  icono?: ElementType;
  /** Ruta de regreso. Se omite en pantallas que son el destino final. */
  volverHref?: string;
  volverLabel?: string;
  /** Filtros y acciones del módulo. En celular bajan a su propia fila. */
  acciones?: ReactNode;
  className?: string;
}

/**
 * Encabezado de módulo. Antes cada página inventaba el suyo: Planta usaba
 * un enlace de regreso con título desnudo, Entregas una tarjeta blanca con
 * cápsula indigo. Mismo propósito, dos formas y dos acentos distintos.
 */
export function PageHeader({
  titulo,
  descripcion,
  icono: Icono,
  volverHref,
  volverLabel = "Volver al inicio",
  acciones,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {volverHref && (
        <Link
          href={volverHref}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink transition-colors group"
        >
          <ArrowLeft
            className="w-4 h-4 transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          {volverLabel}
        </Link>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {Icono && (
            <span
              className="w-11 h-11 shrink-0 rounded-card bg-sunken ring-1 ring-line flex items-center justify-center text-ink-body"
              aria-hidden="true"
            >
              <Icono className="w-5 h-5" strokeWidth={1.5} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-ink">{titulo}</h1>
            {descripcion && (
              <p className="text-sm text-ink-muted mt-0.5">{descripcion}</p>
            )}
          </div>
        </div>

        {acciones && (
          <div className="flex items-center gap-2 shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
            {acciones}
          </div>
        )}
      </div>
    </header>
  );
}
